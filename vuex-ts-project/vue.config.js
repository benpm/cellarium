module.exports = {
    chainWebpack: config => {
      config.module
        .rule('raw')
        .test(/\.glsl$/)
        .use('raw-loader')
        .loader('raw-loader')
        .end()
    },
}