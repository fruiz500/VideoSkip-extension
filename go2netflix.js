//code injected into Netflix page in order to scrub video to given time (in seconds) since Netflix will crash with the normal seek instruction. By Dmitry Paloskin and Naveen at StackOverflow. Must be executed in page context
var params = new URLSearchParams(document.currentScript.src.split('?')[1]);
var time = parseFloat(params.get('seconds'));
videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
sessions = videoPlayer.getAllPlayerSessionIds();
player = videoPlayer.getVideoPlayerBySessionId(sessions[sessions.length-1]);
player.seek( time * 1000 )