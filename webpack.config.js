const webpack = require('webpack');
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const postcssImport = require('postcss-import');
const autoprefixer = require('autoprefixer');


/**
 * Run `webpack` with NODE_ENV=development to do a dev build.
 *
 * Defaults to production.
 */
const DEVELOPMENT = process.env.NODE_ENV === 'development';


/**
 * Output bundles to /build directory.
 */
const OUTPUT_DIR = path.join(__dirname, 'build');


/**
 * Resolve all modules from this directory.
 */
const RESOLVE_DIR = __dirname;


/**
 * JS loader configuration.
 *
 * Compile with Babel and ignore node_modules.
 */
const JS_LOADER = {
  test: /\.jsx?$/,
  loader: 'babel-loader',
  exclude: /node_modules/,
};


/**
 * JSON loader configuration.
 *
 * (some npm modules require .json files).
 */
const JSON_LOADER = {
  test: /\.json$/,
  loader: 'json-loader',
};


/**
 * CSS Modules Loader configuration.
 */

// The pattern for classnames generated by CSS modules:
const CSS_MODULES_CLASS_PATTERN = '[name]__[local]___[hash:base64:5]';

// The name of the postcss plugin pack for CSS Modules.
const CSS_MODULES_PACK = 'cssmodules';

// Params for css-loader to set up CSS Modules with a specific class pattern
// and add postcss-loader:
const CSS_MODULES = `?modules&localIdentName=${CSS_MODULES_CLASS_PATTERN}&importLoaders=1!postcss-loader?pack=${CSS_MODULES_PACK}`;

// Loaders for CSS Modules.
const CSS_MODULES_LOADERS = {
  CLASSNAMES_ONLY: `css-loader/locals${CSS_MODULES}`,
  STYLETAGS: `style-loader!css-loader${CSS_MODULES}`,
  FILE: ExtractTextPlugin.extract('style-loader', `css-loader${CSS_MODULES}`),
};


/**
 * Global CSS loader configuration.
 *
 * (i.e. anything that isn't CSS Modules).
 */

// The name of the postcss plugin pack for global CSS.
const CSS_PACK = 'css';

// Loaders for global CSS.
const CSS_LOADERS = {
  STYLETAGS: 'style-loader!css-loader',
  FILE: ExtractTextPlugin.extract('style-loader', `css-loader!postcss-loader?pack=${CSS_PACK}`),
};



/**
 * CLIENT CONFIGURATION.
 *
 * Generates the client bundles served to the browser.
 */
const client = {

  devtool: DEVELOPMENT ? 'cheap-module-source-map' : 'source-map',

  entry: {
    main: [
      './src/client'
    ],
    vendor: [
      'events',
      'lodash',
      'react',
      'react-addons-update',
      'react-dom',
      'react-router',
      'superagent',
    ],
  },

  output: {
    path: `${OUTPUT_DIR}/client`,
    filename: '[name].js',
    chunkFilename: '[id].chunk.js',
    publicPath: '/static/',
  },

  resolve: {
    root: RESOLVE_DIR,
    alias: {
      common: 'src/styles/common.css',
    },
  },

  module: {
    loaders: [

      JS_LOADER,

      JSON_LOADER,

      // CSS Modules.
      {
        test: /\.css$/,
        exclude: [
          /node_modules/,
          /\.global\.css$/,
        ],
        loader: DEVELOPMENT ? CSS_MODULES_LOADERS.STYLETAGS :
            CSS_MODULES_LOADERS.FILE,
      },

      // CSS in node_modules.
      {
        test: /\.css$/,
        include: /node_modules/,
        loader: DEVELOPMENT ? CSS_LOADERS.STYLETAGS :
            CSS_LOADERS.FILE,
      },

      // Global CSS aka .global.css files.
      {
        test: /\.global\.css$/,
        loader: DEVELOPMENT ? CSS_LOADERS.STYLETAGS :
            CSS_LOADERS.FILE,
      },
    ],
  },

  postcss: function (webpack) {
    // NOTE(dbow): postcssImport is used to add the shared classes in
    // src/styles/modules to src/styles/common.css to avoid the following
    // issue when using CSS Modules' composition feature:
    //   https://github.com/css-modules/css-modules/issues/12
    // See also:
    //   https://github.com/postcss/postcss-loader#integration-with-postcss-import
    return {
      [ CSS_MODULES_PACK ]: [
        // NOTE(dbow): It *must* be first in the array and use the local
        // webpack function argument.
        postcssImport({
          addDependencyTo: webpack,
        }),
        autoprefixer],
      [ CSS_PACK ]: [autoprefixer],
    };
  },

  plugins: [
    // NOTE(dbow): If vendor chunk changes, may need the plugin mentioned here:
    //     https://webpack.github.io/docs/list-of-plugins.html#2-explicit-vendor-chunk
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks: Infinity,
    }),
  ],
};

if (!DEVELOPMENT) {
  client.plugins.push(
    new ExtractTextPlugin('[name].css', {
      // This ensures chunk CSS is only loaded on demand. This may create a FOUC.
      allChunks: false,
    }),
    // Aggressively compress main chunk.
    new webpack.optimize.UglifyJsPlugin({
      include: /main/,
    }),
    // Only remove comments of vendor chunks.
    new webpack.optimize.UglifyJsPlugin({
      exclude: /main/,
      sourceMap: false,
      compress: {
        warnings: false
      },
      output: {
        comments: false
      },
    })
  );
}


/**
 * SERVER CONFIGURATION.
 *
 * Generates the server bundle. Includes the express web server and server
 * rendering.
 */
const server = {

  devtool: DEVELOPMENT ? 'cheap-module-source-map' : 'source-map',

  entry: './src/server.js',

  target: 'node',

  // Only bundle the source code. All other imports are treated as externals.
  // https://webpack.github.io/docs/configuration.html#externals
  externals: [
    /^[a-z\-0-9]+$/,
    // Ignore the 'common' alias below for shared CSS.
    {
      common: false,
    }
  ],

  resolve: {
    root: RESOLVE_DIR,
    alias: {
      common: 'src/styles/common.css',
    },
  },

  output: {
    path: `${OUTPUT_DIR}/server`,
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },

  // Node variables:
  //     http://jlongster.com/Backend-Apps-with-Webpack--Part-II#Node-Variables
  node: {
    __filename: true,
    __dirname: true,
  },

  module: {
    loaders: [

      JS_LOADER,

      JSON_LOADER,

      // CSS Modules.
      {
        test: /\.css$/,
        exclude: [
          /node_modules/,
          /\.global\.css$/,
        ],
        loader: CSS_MODULES_LOADERS.CLASSNAMES_ONLY,
      },

      // CSS in node_modules.
      {
        test: /\.css$/,
        include: /node_modules/,
        loader: 'null-loader',
      },

      // Global CSS aka .global.css files.
      {
        test: /\.global\.css$/,
        loader: 'null-loader',
      },
    ]
  },

  postcss: function (webpack) {
    return {
      [ CSS_MODULES_PACK ]: [
        // NOTE(dbow): See NOTE in client config postcss method.
        postcssImport({
          addDependencyTo: webpack,
        })
      ],
    };
  },

  plugins: [
    // Import source-map-support at top of bundle for proper node source maps:
    //     http://jlongster.com/Backend-Apps-with-Webpack--Part-I#Sourcemaps,-CSS,-and
    new webpack.BannerPlugin('require("source-map-support").install();', {
      raw: true,
      entryOnly: false,
    }),
  ],
};


// NOTE(dbow): When using Hot Module Replacement, the client bundle is served
// by the webpack dev server so we only return the server bundle.

module.exports = process.env.HMR ? server : [client, server];

