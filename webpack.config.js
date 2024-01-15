
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: './src/index.ts', // Your main TypeScript entry file
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'static/js')
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'src/index.js', to: 'index.js' },
            ],
        }),
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'static'),
        },
        hot: true,
        liveReload: true,
        historyApiFallback: true,
        open: true,
        port: 8080,
        host: 'localhost'
    },
};
