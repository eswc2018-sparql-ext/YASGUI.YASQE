/* global __dirname, require, module*/
const LiveReloadPlugin = require('webpack-livereload-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require("webpack");
const UglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
const path = require("path");
const isProd = process.env.NODE_ENV === "production";
const isDev = !isProd
let libraryName = "yasqe";

let plugins = [],
  outputFile;

if (isDev) {
  outputFile = libraryName + ".js";
  //ignore these, to avoid infinite loops while watching
  plugins.push(new webpack.WatchIgnorePlugin([/\.js$/, /\.d\.ts$/]));
  plugins.push(new LiveReloadPlugin())
  plugins.push(new webpack.HotModuleReplacementPlugin())
  plugins.push(new HtmlWebpackPlugin())
} else {
  plugins.push(new UglifyJsPlugin({ minimize: true }));
  outputFile = libraryName + ".min.js";
}

const config = {
  entry: "./src/index.ts",
  devtool: isDev ? "cheap-module-source-map" : false,
  cache: isDev,
  output: {
    path: __dirname + "/build",
    filename: outputFile,
    library: libraryName,
    libraryTarget: "umd",
    umdNamedDefine: true
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          configFile: `tsconfig${isProd?'-build':''}.json`
          // transpileOnly: isDev
        }
      },
      {
        test: /\.scss$/,
        loader: 'sass-loader'
      }
    ]
  },
  resolve: {
    modules: [path.resolve("./node_modules"), path.resolve("./src")],
    extensions: [".json", ".js", ".ts", ".scss"]
  },
  devServer: {
    historyApiFallback: true,
    hot: true
  },
  plugins: plugins
};

module.exports = config;
