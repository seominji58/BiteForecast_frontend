/**
 * 출시 APK 서명 (원스토어, 2026-11-25).
 * android/ 는 prebuild 로 매번 새로 만들어지므로 build.gradle 에 출시 서명 설정을 이 플러그인이 넣는다.
 * 키 파일·비밀번호는 저장소 밖 ~/.gradle/gradle.properties 의 BITEFORECAST_UPLOAD_* 값에서 읽는다.
 * 값이 없는 컴퓨터에서는 예전처럼 디버그 키로 서명한다 (경고 출력) — 그 APK 는 스토어에 올리면 안 된다.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (project.hasProperty('BITEFORECAST_UPLOAD_STORE_FILE')) {
                storeFile file(BITEFORECAST_UPLOAD_STORE_FILE)
                storePassword BITEFORECAST_UPLOAD_STORE_PASSWORD
                keyAlias BITEFORECAST_UPLOAD_KEY_ALIAS
                keyPassword BITEFORECAST_UPLOAD_KEY_PASSWORD
            }
        }`;

const RELEASE_USE = `if (project.hasProperty('BITEFORECAST_UPLOAD_STORE_FILE')) {
                signingConfig signingConfigs.release
            } else {
                logger.warn('⚠ 출시 서명 키(BITEFORECAST_UPLOAD_*)가 없어 디버그 키로 서명합니다. 스토어에 올리지 마세요.')
                signingConfig signingConfigs.debug
            }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('BITEFORECAST_UPLOAD_STORE_FILE')) return cfg;
    // signingConfigs { debug { ... } } 뒤에 release 추가
    src = src.replace(/(signingConfigs \{\s*debug \{[^}]*\})/, `$1${RELEASE_CONFIG}`);
    // buildTypes.release 의 디버그 서명을 출시 서명으로
    src = src.replace(/(release \{[^{}]*?)signingConfig signingConfigs\.debug/, `$1${RELEASE_USE}`);
    if (!src.includes('signingConfig signingConfigs.release')) {
      throw new Error('with-release-signing: build.gradle 형식이 바뀌어 출시 서명을 넣지 못했어요');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
