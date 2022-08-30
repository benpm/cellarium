module.exports = {
  chainWebpack: config => {
    config.module
      .rule('raw')
      .test(/\.(glsl|txt)$/)
      .use('raw-loader')
      .loader('raw-loader')
      .end()
  },
  publicPath: "/cellarium/"
}