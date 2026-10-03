module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // 原先有 react-native-reanimated/plugin。该库在 src/ 中零引用、也无其它包依赖它，
    // 属于未使用的重型原生模块，已从依赖中移除，插件一并去掉（2026-10-03）。
  };
};
