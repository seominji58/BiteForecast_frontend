/**
 * app.json 을 그대로 쓰고, 환경변수에 따라 달라지는 설정만 여기서 더한다.
 *
 * 구글 로그인: EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID 가 있을 때만 iOS URL 스킴을 등록한다
 * (예: 1234-abcd.apps.googleusercontent.com → com.googleusercontent.apps.1234-abcd).
 * 값이 없으면 구글 로그인 버튼이 숨겨지고 이메일 로그인만 동작한다.
 */
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...(config.plugins ?? [])];
  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }
  return { ...config, plugins };
};
