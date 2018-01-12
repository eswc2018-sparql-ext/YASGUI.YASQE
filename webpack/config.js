/* global __dirname, require, module*/
const LiveReloadPlugin = require("webpack-livereload-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const UglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
const path = require("path");
const isProd = process.env.NODE_ENV === "production";
const isDev = !isProd;
const scopify   = require('postcss-scopify');
let libraryName = "Yasqe";
const ExtractTextPlugin = require("extract-text-webpack-plugin");

let plugins = [],
  outputFile;

if (isDev) {
  outputFile = libraryName.toLowerCase() + ".js";
  //ignore these, to avoid infinite loops while watching
  plugins.push(new webpack.WatchIgnorePlugin([/\.js$/, /\.d\.ts$/]));
  plugins.push(new LiveReloadPlugin());
  plugins.push(new webpack.HotModuleReplacementPlugin());
  plugins.push(
    new HtmlWebpackPlugin({
      template: "webpack/index.html"
    })
  );
} else {
  plugins.push(new UglifyJsPlugin({ minimize: true }));
  plugins.push(new ExtractTextPlugin( libraryName.toLowerCase() + ".min.css" ))
  outputFile = libraryName.toLowerCase() + ".min.js";
}

const config = {
  entry: "./src/index.ts",
  devtool: isDev ? "cheap-module-source-map" : false,
  cache: isDev,
  output: {
    path: path.resolve(__dirname, "..", "build"),
    publicPath: '/',
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
          configFile: `tsconfig-build.json`
          // transpileOnly: isDev
        }
      },
      {
        test: /\.scss$/,
        use: isDev
          ? [
              "style-loader",
              { loader: "css-loader", options: { importLoaders: 2 } },
              {
                loader: "postcss-loader",
                options: { plugins:[scopify('.yasqe')] }
              },
              'sass-loader'
            ]
          : ExtractTextPlugin.extract({
              fallback: "style-loader",
              use: ["css-loader", 'sass-loader']
            })
      },
      {
        test: /\.css$/,
        use: isDev
          ? [
              "style-loader",
              { loader: "css-loader", options: { importLoaders: 1 } },
              {
                loader: "postcss-loader",
                options: { plugins:[scopify('.yasqe')] }
              }
            ]
          : ExtractTextPlugin.extract({
              fallback: "style-loader",
              use: ["css-loader"]
            })
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
