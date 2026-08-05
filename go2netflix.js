//code injected into Netflix page in order to scrub video to given time (in seconds) since Netflix will crash with the normal seek instruction. By Dmitry Paloskin and Naveen at StackOverflow. Must be executed in page context
const params = new URLSearchParams(document.currentScript.src.split('?')[1]);
const time = parseFloat(params.get('seconds'));
const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
const sessions = videoPlayer.getAllPlayerSessionIds();
const player = videoPlayer.getVideoPlayerBySessionId(sessions[sessions.length - 1]);
player.seek(time * 1000);