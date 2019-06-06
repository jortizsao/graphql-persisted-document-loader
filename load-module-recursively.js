// This code is copied from Webpack's code and modified so that it can load modules
// recursively, otherwise the loader for persisted queries fails if there are
// queries that depend on other files.

// The file copied from is https://github.com/webpack/webpack/blob/master/lib/dependencies/LoaderPlugin.js
const LoaderDependency = require("webpack/lib/dependencies/LoaderDependency");
const NormalModule = require("webpack/lib/NormalModule");

module.exports = (loaderContext, request, callback) => {
  const { _compilation: compilation, _module: module } = loaderContext;

  const dep = new LoaderDependency(request);
  dep.loc = {
    name: request
  };
  const factory = compilation.dependencyFactories.get(dep.constructor);
  if (factory === undefined) {
    return callback(
      new Error(
        `No module factory available for dependency type: ${
          dep.constructor.name
        }`
      )
    );
  }
  compilation.semaphore.release();
  compilation.addModuleDependencies(
    module,
    [
      {
        factory,
        dependencies: [dep]
      }
    ],
    true,
    "lm",
    true,
    err => {
      compilation.semaphore.acquire(() => {
        if (err) {
          return callback(err);
        }
        if (!dep.module) {
          return callback(new Error("Cannot load the module"));
        }
        // TODO consider removing this in webpack 5
        if (dep.module instanceof NormalModule && dep.module.error) {
          return callback(dep.module.error);
        }
        if (!dep.module._source) {
          throw new Error(
            "The module created for a LoaderDependency must have a property _source"
          );
        }
        let source, map;
        const moduleSource = dep.module._source;
        if (moduleSource.sourceAndMap) {
          const sourceAndMap = moduleSource.sourceAndMap();
          map = sourceAndMap.map;
          source = sourceAndMap.source;
        } else {
          map = moduleSource.map();
          source = moduleSource.source();
        }
        if (dep.module.buildInfo.fileDependencies) {
          for (const d of dep.module.buildInfo.fileDependencies) {
            loaderContext.addDependency(d);
          }
        }
        if (dep.module.buildInfo.contextDependencies) {
          for (const d of dep.module.buildInfo.contextDependencies) {
            loaderContext.addContextDependency(d);
          }
        }
        return callback(null, source, map, dep.module);
      });
    }
  );
};
