        /*
		@source: https://github.com/fruiz500/VideoSkip-extension

        @licstart  The following is the entire license notice for the
        JavaScript code in this page.

        Copyright (C) 2021  Francisco Ruiz

        The JavaScript code in this page is free software: you can
        redistribute it and/or modify it under the terms of the GNU
        General Public License (GNU GPL) as published by the Free Software
        Foundation, either version 3 of the License, or (at your option)
        any later version.  The code is distributed WITHOUT ANY WARRANTY;
        without even the implied warranty of MERCHANTABILITY or FITNESS
        FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.

        As additional permission under GNU GPL version 3 section 7, you
        may distribute non-source (e.g., minimized or compacted) forms of
        that code without the copy of the GNU GPL normally required by
        section 4, provided you include this license notice and a URL
        through which recipients can access the Corresponding Source.


        @licend  The above is the entire license notice
        for the JavaScript code in this page.
        */

var name = '';								//global variable with name of skip file, minus extension
var cuts = [];				//global variable containing the cuts, each array element is an object with this format {startTime,endTime,text,action}
var pageInfo = window.location.hash.slice(1).split('&');		//sent with this page's name as the window opens, this contains ativeTabId + '&' + serviceName
var activeTabId = parseInt(pageInfo[0]);		//sent with this page's name as the window opens
var serviceName = pageInfo[1];				//will be used for automatic offsets
var offsets = {};								//to contain offsets for different sources. Initialized with first time or screenshot

var ua = navigator.userAgent.toLowerCase(); 		//to choose fastest filter method, per https://jsben.ch/5qRcU
if (ua.indexOf('safari') != -1) { 
  if (ua.indexOf('chrome') == -1){ var isSafari = true
  }else{ var isChrome = true
  }
}else if(typeof InstallTrigger !== 'undefined'){var isFirefox = true
}else if (document.documentMode || /Edge/.test(navigator.userAgent)){var isEdge = true
}

var oldPixelRatio = window.devicePixelRatio;					//for resizing window after zoom
var stretchFact = 1;												//for resizing on Edit
var startSize = oldPixelRatio > 1.2 ? oldPixelRatio / 2 : oldPixelRatio;

setTimeout(function(){window.resizeTo( window.outerWidth * startSize, window.outerHeight * startSize)},400);	//correct initial zoom
var resInt = setInterval(resizeScr,500)		//look for resizing every half second

//to correct for zoom while the window is displayed, and grow window when edit section is shown
function resizeScr(){
	var pixelRatio = window.devicePixelRatio;
	window.resizeTo( window.outerWidth * pixelRatio / oldPixelRatio, window.outerHeight * pixelRatio / oldPixelRatio * stretchFact);
	oldPixelRatio = pixelRatio;
	stretchFact = 1
}

//loads the skips file
function loadFileAsURL(){
	var fileToLoad = skipFile.files[0],
		fileReader = new FileReader();
	fileReader.onload = function(fileLoadedEvent){
		var URLFromFileLoaded = fileLoadedEvent.target.result;
		var extension = fileToLoad.name.slice(-4);
		if(extension == ".skp"){
			var data = URLFromFileLoaded.split('data:image/jpeg;base64,');		//separate skips from screenshot
			var data1 = data[0].split('{');										//separate skips from offsets
			name = fileToLoad.name.slice(0,-4).replace(/ \[[a-z0-9\-]+\]/,'');	//remove extension and service list
			skipBox.value = data1[0].trim();
			if(data1[1]) offsets = JSON.parse('{' + data1[1].trim());			//make offsets object
			if(data[1]) screenShot.src = 'data:image/jpeg;base64,' + data[1];	//extract screenshot
			showMsg(fileToLoad.name + chrome.i18n.getMessage('contentOfFile'));
			setTimeout(function(){
				justLoaded = true;
				sendData();
				applyOffset()
			},100)		//give it some time to load before data is extracted to memory and sent; also set switches
		}else{
			showMsg(chrome.i18n.getMessage('wrongFile'))
		}
	};
	fileReader.readAsText(fileToLoad)
}

//similar, for loading subtitles to generate skips for profanity
function loadSub(){
	var fileToLoad = subFile.files[0],
		fileReader = new FileReader();
	fileReader.onload = function(fileLoadedEvent){
		var URLFromFileLoaded = fileLoadedEvent.target.result;
		var extension = fileToLoad.name.slice(-4);
		if(extension == ".vtt" || extension == ".srt"){						//allow only .vtt and .srt formats
			var subs = URLFromFileLoaded;										//get subs in text format, to be edited
			subs = subs.replace(/(\d),(\d)/g,'$1.$2');						//convert decimal commas to periods
			autoBeepGen(subs);
			sendData()
		}
	};
	fileReader.readAsText(fileToLoad)
}

//makes silenced profanity skips timed to subtitles with words in blockList
function autoBeepGen(subs){
	var blockListExp = new RegExp(blockList.textContent.replace(/, +/g,'|'),"g");
	var subObj = PF_SRT.parse(subs);				//similar in structure to cuts, with keys: startTime, endTime, text, action (empty)
	writeIn('\n\n');
	for(var i = 0; i < subObj.length; i++){
		var word = subObj[i].text.toLowerCase().match(blockListExp);
		if(word){	//word found in block list; add extra .3 s buffer in case there are two in a row
			writeIn(toHMS(subObj[i].startTime - 0.15) + ' --> ' + toHMS(subObj[i].endTime + 0.15) + '\nprofane word (' + word[0] + ')\n\n')
		}
	}
	var	initialData = skipBox.value.trim().split('\n').slice(0,2);		//first two lines containing screenshot timing
	cuts = PF_SRT.parse(skipBox.value);
	cuts.sort(function(a, b){return a.startTime - b.startTime;});
	times2box();
	skipBox.value = initialData.join('\n') + '\n\n' + skipBox.value;
	curseNum.value = 3
}

//loads the screen shot from file, if the direct take didn't work
function loadShot(){
	var fileToLoad = shotFile.files[0],
		fileReader = new FileReader();
	fileReader.onload = function(fileLoadedEvent){
		var URLFromFileLoaded = fileLoadedEvent.target.result;
		resizedShot(URLFromFileLoaded, 240)		//resize to standard height 240 px into screenshot, asynchronous function
	};
	if(fileToLoad){
		fileReader.readAsDataURL(fileToLoad);
		showMsg(chrome.i18n.getMessage('shotLoaded'))
	}else{
		showMsg(chrome.i18n.getMessage('shotCanceled'))
	}
}

// Takes a data URI and returns the Data URI corresponding to the resized image at the wanted size. Adapted from a function by Pierrick Martellière at StackOverflow
function resizedShot(dataURIin, wantedHeight){		//width will be calculated to maintain aspect ratio
	// We create an image to receive the Data URI
	var img = document.createElement('img');

    // When the event "onload" is triggered we can resize the image.
	img.onload = function() {        
    // We create a canvas and get its context.
		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');
	
	// We set the dimensions of the canvas.
		var inputWidth = this.width,
			inputHeight = this.height;
		canvas.width = inputWidth;
		canvas.height = inputHeight;

		ctx.drawImage(this, 0, 0, inputWidth, inputHeight);

	//Cropping process starts here
		var inputData = ctx.getImageData(0,0,canvas.width,canvas.height),
			data = inputData.data,
			pixels = inputWidth * inputHeight,
			westIndex = pixels * 2,		//starting indices for pixels at cardinal points
			eastIndex = westIndex - 4,
			northIndex = inputWidth * 2,
			southIndex = pixels * 4 - inputWidth * 2,
			trueLeft = 0, trueRight = inputWidth,
			trueTop = 0, trueBottom = inputHeight,
			threshold = 5;					//top and bottom lines may have spurious content;
	
	//now scan middle horizontal line to determine true width; start on edges
		for(var i = 0; i < inputWidth / 2; i++){
			if(data[westIndex]+data[westIndex+1]+data[westIndex+2] > threshold) break;
			trueLeft++;
			westIndex += 4
		}
		for(var i = 0; i < inputWidth / 2; i++){
			if(data[eastIndex]+data[eastIndex+1]+data[eastIndex+2] > threshold) break;
			trueRight--;
			eastIndex -= 4
		}
	//same for height
		for(var i = 0; i < inputHeight / 2; i++){
			if(data[northIndex]+data[northIndex+1]+data[northIndex+2] > threshold) break;
			trueTop++;
			northIndex += inputWidth * 4
		}
		for(var i = 0; i < inputHeight / 2; i++){
			if(data[southIndex]+data[southIndex+1]+data[southIndex+2] > threshold) break;
			trueBottom--;
			southIndex -= inputWidth * 4
		}
	//these are the true dimensions
		var trueWidth = trueRight - trueLeft,
			trueHeight = trueBottom - trueTop;
		
	//resize canvas
		canvas.width = wantedHeight * trueWidth / trueHeight;
		canvas.height = wantedHeight;
		ctx.drawImage(img, trueLeft, trueTop, trueRight-trueLeft, trueBottom-trueTop, 0, 0, canvas.width, canvas.height);
		screenShot.src = canvas.toDataURL('image/jpeg');						
	};

    // We put the Data URI in the image's src attribute
	img.src = dataURIin;
}

//to download data to a file, from StackOverflow
function download(data, filename, type) {
	var a = document.createElement("a");
	var file = new Blob([data], {"type": type}),
		url = URL.createObjectURL(file);
	a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
       document.body.removeChild(a);
       window.URL.revokeObjectURL(url);
    }, 0)
}

//to parse the content of the skip box in something close to .srt format, from StackOverflow
var PF_SRT = function() {
  //SRT format
  var pattern = /([\d:,.]+)\s*-*\>\s*([\d:,.]+)\s*\n([\s\S]*?(?=\n+\s*\d|\n{2}))?/gm;		//no item number, can use decimal dot instead of comma, malformed arrows, no extra lines
  var _regExp;

  var init = function() {
    _regExp = new RegExp(pattern);
  };
  var parse = function(f) {
    if (typeof(f) != "string")
      throw "Sorry, the parser accepts only strings";

    var result = [];
    if (f == null)
      return _subtitles;

    f = f.replace(/\r\n|\r|\n/g, '\n') + '\n\n';

    while ((matches = pattern.exec(f)) != null) {
      result.push(toLineObj(matches));
    }
    return result;
  }
  var toLineObj = function(group) {
    return {
      startTime: fromHMS(group[1]),			//load timings in seconds
      endTime: fromHMS(group[2]),
      text: group[3],
	  action: ''				//no action by default, to be filled later
    };
  }
  init();
  return {
    parse: parse
  }
}();

//to put seconds into hour:minute:second format
function toHMS(seconds) {
	var hours = Math.floor(seconds / 3600);
	seconds -= hours * 3600;
    var minutes = Math.floor(seconds / 60);
    minutes = (minutes >= 10) ? minutes : "0" + minutes;
    seconds = Math.floor((seconds % 60) * 100) / 100;			//precision is 0.01 s
    seconds = (seconds >= 10) ? seconds : "0" + seconds;
    return hours + ":" + minutes + ":" + seconds;
}
  
//the opposite: hour:minute:second string to decimal seconds
function fromHMS(timeString){
	timeString = timeString.replace(/,/,".");			//in .srt format decimal seconds use a comma
	var time = timeString.split(":");
	if(time.length == 3){							//has hours
		return parseInt(time[0])*3600 + parseInt(time[1])*60 + parseFloat(time[2])
	}else if(time.length == 2){					//minutes and seconds
		return parseInt(time[0])*60 + parseFloat(time[1])
	}else{											//only seconds
		return parseFloat(time[0])
	}
}

isSync = false;

//shift all times so the screenshot has correct timing in the video
function syncTimes(){
	if(timeLabels.length == 0){
		showMsg(chrome.i18n.getMessage('time_in_box'));
		return
	}else if(timeLabels[0].length < 1){
		showMsg(chrome.i18n.getMessage('time_in_box'));
		return
	}
	isSync = true;
	chrome.tabs.sendMessage(activeTabId, {message: "need_time"});		//to be continued when the current time is received
	setTimeout(function(){
		makeTimeLabels();
		setTimeout(save2file,100);
		filterLink.click()							//go on to filter tab
	},100)
}

//shift all times according to offset in loaded skip file
function applyOffset(){
	var offset = offsets[serviceName];
	if(offset != undefined){						//there is an offset for the current source, so shift all times
		var	initialData = skipBox.value.trim().split('\n').slice(0,2),					//first two lines
			shotTime = fromHMS(initialData[0]);
		for(var i = 0; i < cuts.length; i++){
			cuts[i].startTime += offset;
			cuts[i].endTime += offset
		}
		times2box();											//put shifted times in the box
	
		if(shotTime){										//reconstruct initial data, if present, shifting the shot time as well
			initialData[0] = toHMS(shotTime + offset);
			skipBox.value = initialData.join('\n') + '\n\n' + skipBox.value
		}

		showMsg(chrome.i18n.getMessage('offsetApplied'));
		filterLink.click();								//open filter tab

		for(var service in offsets){						//adjust offsets
			offsets[service] -= offset
		}
		setTimeout(function(){
			setActions();
			makeTimeLabels()
		},100);
	}else{									//no offset found, so scrub to shot time and superimpose
		offsets[serviceName] = 0;			//initialize offset
		syncLink.click();					//go to sync tab
		scrub2shot();
		toggleTopShot()
	}
}

//puts data from the cuts array into skipBox
function times2box(){
	var text = '';
	for(var i = 0; i < cuts.length; i++){
		text += toHMS(cuts[i].startTime) + ' --> ' + toHMS(cuts[i].endTime) + '\n' + cuts[i].text + '\n\n'
	}
	skipBox.value = text.trim()
}

var isScrub = false;

//insert string in box, at cursor or replacing selection
function writeIn(string){
	var start = skipBox.selectionStart,
		end = skipBox.selectionEnd,
		newEnd = start + string.length;
	skipBox.value = skipBox.value.slice(0,start) + string + skipBox.value.slice(end,skipBox.length);
	if(isScrub){
		skipBox.setSelectionRange(start,newEnd)
	}else{
		skipBox.setSelectionRange(newEnd,newEnd);
	}
	setTimeout(function(){
		cuts = PF_SRT.parse(skipBox.value);
		setActions();
		makeTimeLabels()}
	,100);
	skipBox.focus()
}

//insert things in box
function writeTime(){
	isSync = false;
	chrome.tabs.sendMessage(activeTabId, {message: "need_time"});
}

var isSilence = false;

//insert quick silence
function writeSilence(){
	isSilence = true;
	chrome.tabs.sendMessage(activeTabId, {message: "need_time"})
}

//display warning message in all tabs
function showMsg(text){
	boxMsg1.textContent = text;
	boxMsg2.textContent = text;
	boxMsg3.textContent = text;
	boxMsg4.textContent = text
}

//gets index of a particular HMS time in the box, by location; returns null if the cursor is not on a time label
function getTimeIndex(){
	var start = skipBox.selectionStart,
		end = skipBox.selectionEnd;
	for(var i = 0; i < timeLabels[0].length; i++){
		if(timeLabels[1][i] <= start && timeLabels[2][i] >= end) return i
	}
}

var	deltaT = 0.0417;				//seconds for each frame at 24 fps

//called by forward buttons
function fwdSkip(){
	if(altMode.checked){										//special mode for shifting auto profanity skips, in case subtitle file was off
		shiftProfSkips(true)

	}else{
		if(skipBox.selectionStart != skipBox.selectionEnd){							//there is a selection
			var index = getTimeIndex(),
				tol = 0.02;
			if(index != null){
				skipBox.setSelectionRange(timeLabels[1][index],timeLabels[2][index]);
				var selectedTime = fromHMS(timeLabels[0][index]);
				var timeShift = fineMode.checked ? deltaT : deltaT*10;
				chrome.tabs.sendMessage(activeTabId, {message: "shift_time", timeShift: timeShift});
				isScrub = true;
				chrome.tabs.sendMessage(activeTabId, {message: "need_time"});		
				skipBox.focus()
			}
		}else{											//scrub by a small amount
			var timeShift = fineMode.checked ? deltaT : deltaT*10;
			chrome.tabs.sendMessage(activeTabId, {message: "shift_time", timeShift: timeShift})
		}
	}
}

//called by back buttons
function backSkip(){
	if(altMode.checked){										//special mode for shifting auto profanity skips, in case subtitle file was off
		shiftProfSkips(true)

	}else{
		if(skipBox.selectionStart != skipBox.selectionEnd){							//there is a selection
			var index = getTimeIndex(),
				tol = 0.02;
			if(index != null){
				skipBox.setSelectionRange(timeLabels[1][index],timeLabels[2][index]);
				var selectedTime = fromHMS(timeLabels[0][index]);
				var timeShift = fineMode.checked ? deltaT : deltaT*10;
				chrome.tabs.sendMessage(activeTabId, {message: "shift_time", timeShift: - timeShift, isSuper: isSuper});
				isScrub = true;
				chrome.tabs.sendMessage(activeTabId, {message: "need_time"});
				skipBox.focus()
			}
		}else{											//scrub by a small amount
			var timeShift = fineMode.checked ? deltaT : deltaT*10;
			chrome.tabs.sendMessage(activeTabId, {message: "shift_time", timeShift: - timeShift, isSuper: isSuper})
		}
	}
}

//called by fast forward buttons
function fFwdToggle(){
	skipBox.selectionStart = skipBox.selectionEnd;		//clear selection, if any
	skipBox.focus();
	chrome.tabs.sendMessage(activeTabId, {message: "fast_toggle"})
}

//called by the above, to shift auto-generated profanity skips
function shiftProfSkips(isFwd){
	var timeShift = 0,
		isFine = fineMode.checked,
		initialData = skipBox.value.trim().split('\n').slice(0,2);					//first two lines
	for(var i = 0; i < cuts.length; i++){
		if(cuts[i].text.match(/profane word \(/)){									//do it only for auto-generated skips
			timeShift = (isFine ? deltaT : deltaT*10)*(isFwd ? 1 : -1);
			cuts[i].startTime += timeShift;
			cuts[i].endTime += timeShift
		}
	}
	chrome.tabs.sendMessage(activeTabId, {message: "skip_data", cuts: cuts, switches: switches});		//so the content script has it too
	times2box();
	if(initialData){										//reconstruct initial data, if present
		skipBox.value = initialData.join('\n') + '\n\n' + skipBox.value
	}
}

//scrub to first time in the box, unless a time is selected
function scrub2shot(){
	if(timeLabels.length == 0){
		showMsg(chrome.i18n.getMessage('time_in_box'));
		return
	}else if(timeLabels[0].length < 1){
		showMsg(chrome.i18n.getMessage('time_in_box'));
		return
	}
	var index = getTimeIndex();
	if(index != null){
		skipBox.setSelectionRange(timeLabels[2][index],timeLabels[2][index]);		//deselect if previously selected
		chrome.tabs.sendMessage(activeTabId, {message: "change_time", time: fromHMS(timeLabels[0][index]), isSuper: isSuper})
		skipBox.focus()
	}else{											//scrub to 1st time
		chrome.tabs.sendMessage(activeTabId, {message: "change_time", time: fromHMS(timeLabels[0][0]), isSuper: isSuper})	
	}
}

var isSuper = false;

//put the screenshot on top of the video so a perfect match can be found, and back
function toggleTopShot(){
	if(screenShot.src == ''){
		isSuper = true;
		showMsg(chrome.i18n.getMessage('no_superimpose'));
	}
	if(isSuper){
		isSuper = false;
		chrome.tabs.sendMessage(activeTabId, {message: "superimpose", status: false})
	}else{
		isSuper = true;
		chrome.tabs.sendMessage(activeTabId, {message: "superimpose", status: true, dataURI: screenShot.src, ratio: screenShot.width/screenShot.height})		
	}
}

var timeLabels = [];

//remakes array timeLabels containing HMS times, plus their positions in the box [HMS time, start, end]
function makeTimeLabels(){
	timeLabels = [[],[],[]];						//string, startPosition, endPosition
	var	text = skipBox.value,
		string, start, end = 0;
	var matches = text.match(/\d+[\d:.]+/g);
	if(matches){
		for(var i = 0; i < matches.length; i++){
			string = matches[i];
			timeLabels[0][i] = string;
			start = text.indexOf(string,end)
			timeLabels[1][i] = start;
			end = start + string.length;
			timeLabels[2][i] = end
		}
	}
	if(isSuper) toggleTopShot()
}

var switches = [false,false,false,false,false,false];

//record position of content switches
function recordSwitches(){
	var boxes = filters.querySelectorAll('input');
	for(var i = 0; i < boxes.length; i++){
		switches[i] = boxes[i].value != 0
	}
}

//request screenshot
function takeShot(){
	chrome.tabs.sendMessage(activeTabId, {message: "need_shot", needTime: true})
}

var justLoaded = false;		//for setting switches on file load

//send settings to the content script
function sendData(){
	cuts = PF_SRT.parse(skipBox.value);
	if(justLoaded) setSwitches();
	justLoaded = false;
	setActions();
	recordSwitches();
	chrome.tabs.sendMessage(activeTabId, {message: "skip_data", cuts: cuts, switches: switches});
	makeTimeLabels()
}

//save skips to file
function save2file(){
	if(screenShot.src == '' && timeLabels.length == 0) return;
	var sourceList = Object.keys(offsets);
	if(sourceList.length == 0) offsets[serviceName] = 0;					//if never loaded before
	sourceList.sort(function(a,b){return b.length - a.length;});		//sort alphabetically
	if(!name) name = prompt(chrome.i18n.getMessage('fileName'));
	download(skipBox.value + '\n\n' + JSON.stringify(offsets) + '\n\n' + screenShot.src, name + ' [' + sourceList.join('-') + '].skp', "text/plain");
	showMsg(chrome.i18n.getMessage('fileSaved') + name + ' [' + sourceList.join('-') + '].skp ' + chrome.i18n.getMessage('fileSaved2'))
}

//to move and resize superimposed shot
document.onkeydown = checkKey;

function checkKey(e) {
  if(isSuper){								//this only works when a screenshot is superimposed on the video
    e = e || window.event;	
	var isFine = fineMode.checked != !!e.shiftKey,		//XOR of the two things
		isAlt = altMode.checked != !!e.altKey;		
	if (e.keyCode == '38') {			//alt combinations move, unshifted resizes, hold Shift for fine movement
        // up arrow
		chrome.tabs.sendMessage(activeTabId, {message: "move_shot", isAlt: isAlt, dir: 'up', isFine: isFine})
	}
	else if (e.keyCode == '40') {
        // down arrow
		chrome.tabs.sendMessage(activeTabId, {message: "move_shot", isAlt: isAlt, dir: 'down', isFine: isFine})			
	}
	else if (e.keyCode == '37') {
       // left arrow
		chrome.tabs.sendMessage(activeTabId, {message: "move_shot", isAlt: isAlt, dir: 'left', isFine: isFine})
	}
	else if (e.keyCode == '39') {
       // right arrow
		chrome.tabs.sendMessage(activeTabId, {message: "move_shot", isAlt: isAlt, dir: 'right', isFine: isFine})
	}
  }
}

skipFile.addEventListener('change', loadFileAsURL);

exchangeBtn.addEventListener('click', function(){window.open('https://videoskip.org/exchange')});

shotFile.addEventListener('change', loadShot);

subFile.addEventListener('change', loadSub);

timeBtn.addEventListener('click', writeTime);

arrowBtn.addEventListener('click', function(){writeIn(' --> ')});

beepBtn.addEventListener('click', writeSilence);

helpBtn.addEventListener('click', function(){
	window.open('help.html')
});

showList.addEventListener('click', function(){
	if(blockList.style.display == 'block'){
		blockList.style.display = 'none'
	}else{
		blockList.style.display = 'block'
	}
});

saveFile.addEventListener('click', save2file);

skipBox.addEventListener('change', sendData);

filters.addEventListener('change', sendData);

shotBtn.addEventListener('click',takeShot);

shotFileBtn.style.display = 'none';

backBtn.addEventListener('click',backSkip);

fineMode.addEventListener('click',fineSync);

fwdBtn.addEventListener('click',fwdSkip);

fFwdBtn.addEventListener('click',fFwdToggle);

backBtn2.addEventListener('click',backSkip);

fineMode2.addEventListener('click',fineSync);

fwdBtn2.addEventListener('click',fwdSkip);

fFwdBtn2.addEventListener('click',fFwdToggle);

shotTimeBtn.addEventListener('click',scrub2shot);

autoBtn.addEventListener('click',function(){
	if(screenShot.src == ''){
		showMsg(chrome.i18n.getMessage('screenshot_first'));
		return
	}
	if(!isSuper) toggleTopShot();
	chrome.tabs.sendMessage(activeTabId, {message: "auto_find"})
});

moveBtn.addEventListener('click',toggleTopShot);

syncBtn.addEventListener('click',syncTimes);

//check the two Fine mode boxes as one
function fineSync(){
	if(this.checked){
		fineMode.checked = true;
		fineMode2.checked = true
	}else{
		fineMode.checked = false;
		fineMode2.checked = false
	}
}

<!--variables and functions for making tabs, by Matt Doyle 2009-->
var tabLinks = new Array(),
	contentDivs = new Array();

function initTabs(){

      // Grab the tab links and content divs from the page
      var tabListItems = document.getElementById('tabs').childNodes;
      for( var i = 0; i < tabListItems.length; i++){
        if(tabListItems[i].nodeName == "LI"){
          var tabLink = getFirstChildWithTagName( tabListItems[i], 'A' );
          var id = getHash( tabLink.getAttribute('href'));
          tabLinks[id] = tabLink;
          contentDivs[id] = document.getElementById(id)
        }
      }

      // Assign onclick events to the tab links, and
      // highlight the first tab
      var i = 0;

      for(var id in tabLinks){
        tabLinks[id].onclick = showTab;
        tabLinks[id].onfocus = function(){ this.blur()};
        if (i == 0) tabLinks[id].className = 'selected';
        i++
      }

      // Hide all content divs except the first
      var i = 0;

      for(var id in contentDivs){
        if( i != 0 ) contentDivs[id].className = 'tabContent hide';
        i++
      }
}

function showTab(){
      var selectedId = getHash( this.getAttribute('href'));

      // Highlight the selected tab, and dim all others.
      // Also show the selected content div, and hide all others.
      for(var id in contentDivs){
        if(id == selectedId){
          tabLinks[id].className = 'selected';
          contentDivs[id].className = 'tabContent'
        }else{
          tabLinks[id].className = '';
          contentDivs[id].className = 'tabContent hide'
        }
      }
      // Stop the browser following the link
      return false
}

function getFirstChildWithTagName(element, tagName){
      for(var i = 0; i < element.childNodes.length; i++){
        if(element.childNodes[i].nodeName == tagName) return element.childNodes[i]
      }
}

function getHash(url){
      var hashPos = url.lastIndexOf('#');
      return url.substring(hashPos + 1)
}
//end of tab functions

initTabs();

//faster way to check for content depending on browser; returns a Boolean; regex and stringArray content should match
function isContained(containerStr, regex){
	var result = false;
	if(isFirefox){
		result = containerStr.search(regex) != -1
	}else if(isSafari || isEdge || isChrome){								//below this won't be used in the extension, but left to see
		result = regex.test(containerStr)
	}else{
		result = !!containerStr.match(regex)
	}
	return result
}

//to decide whether a particular content is to be skipped, according to 3-level sliders. Allows alternative and incomplete keywords
function isSkipped(label){
	var nuMatches = label.match(/\d/),
		level = parseInt(nuMatches ? nuMatches[0] : 1);			//if no level is found, make it level 1
	level = level >= 3 ? 3 : level;								//highest level is 3
	if(isContained(label,/sex|nud/)){
		return (parseInt(sexNum.value) + level) > 3
	}else if(isContained(label,/vio|gor/)){
		return (parseInt(violenceNum.value) + level) > 3
	}else if(isContained(label,/pro|cur|hat/)){
		return (parseInt(curseNum.value) + level) > 3
	}else if(isContained(label,/alc|dru|smo/)){
		return (parseInt(boozeNum.value) + level) > 3
	}else if(isContained(label,/fri|sca|int/)){
		return (parseInt(scareNum.value) + level) > 3
	}else if(isContained(label,/oth|bor/)){
		return (parseInt(otherNum.value) + level) > 3
	}else{
		return false
	}
}

//set switches for edits present in skip file; used only when a file is loaded
function setSwitches(){
	var sliders = filters.querySelectorAll('input');
	for(var i = 0; i < 6; i++) sliders[i].value = 0;
	var noGrade = false;
	for(var i = 0; i < cuts.length; i++){
		if(cuts[i].text){
			var label = cuts[i].text.toLowerCase().replace(/\(.*\)/g,'');			//ignore text in parentheses
			if(isContained(label,/sex|nud/)) sexNum.value = 2;
			if(isContained(label,/vio|gor/)) violenceNum.value = 2;
			if(isContained(label,/pro|cur|hat/)) curseNum.value = 2;
			if(isContained(label,/alc|dru|smo/)) boozeNum.value = 2;
			if(isContained(label,/fri|sca|int/)) scareNum.value = 2;
			if(isContained(label,/oth|bor/)) otherNum.value = 2;
			if(!label.match(/\d/)) noGrade = true									//raise flag for ungraded edit
		}
	}
	if(noGrade) setTimeout(function(){
		showMsg(chrome.i18n.getMessage('unGraded'))
	},500)
}

//fills the action field in object cuts, according to the position of the check boxes and the text at each time
function setActions(){
	for(var i = 0; i < cuts.length; i++){
		if(cuts[i].text){
			var ignore = cuts[i].text.includes('//'),										//ignore skip containing // in text
				label = cuts[i].text.toLowerCase().replace(/\(.*\)/g,''),				//ignore text in parentheses
				isAudio = isContained(label,/aud|sou|spe|wor/),
				isVideo = isContained(label,/vid|ima|img/);
			if(ignore){
				cuts[i].action = ''
			}else if(!isAudio && !isVideo){
				cuts[i].action = isSkipped(label) ? 'skip' : ''	
			}else if(isAudio){
				cuts[i].action = isSkipped(label) ? 'mute' : ''
			}else{
				cuts[i].action = isSkipped(label) ? 'blank' : ''
			}
		}
	}
}

//to get the time, screenshot, or other info from the content script
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	var syncFix = 0.043;							//use a time that is actually 1 frame earlier than reported (to correct messaging delays)
    if(request.message == "video_time") {
		if(isSync){																						//re-sync all times
			isSync = false;
			var	initialData = skipBox.value.trim().split('\n').slice(0,2),					//first two lines
				shotTime = fromHMS(initialData[0]),
				seconds = shotTime ? request.time - shotTime : 0;
			seconds -= syncFix;																//apply fix
			for(var i = 0; i < cuts.length; i++){
				cuts[i].startTime += seconds;
				cuts[i].endTime += seconds
			}
			chrome.tabs.sendMessage(activeTabId, {message: "skip_data", cuts: cuts, switches: switches});		//so the content script has it too
			times2box();										//put shifted times in the box
	
			if(shotTime != null){										//reconstruct initial data, if present
				initialData[0] = toHMS(shotTime + seconds);
				skipBox.value = initialData.join('\n') + '\n\n' + skipBox.value
			}
			if(seconds >= 0){
				showMsg(chrome.i18n.getMessage('delayed') + Math.floor(seconds*100)/100 + chrome.i18n.getMessage('seconds'))
			}else{
				showMsg(chrome.i18n.getMessage('advanced') + Math.floor(- seconds*100)/100 + chrome.i18n.getMessage('seconds'))
			}

			for(var service in offsets){						//adjust offsets
				offsets[service] -= seconds
			}
			offsets[serviceName] = 0;								//key for current source set to zero regardless
			
			setTimeout(makeTimeLabels,100)
			
		}else if(isSilence){																	//insert single-word silence
			writeIn(toHMS(request.time - 0.7 - syncFix) + ' --> ' + toHMS(request.time - syncFix) + '\nprofane word\n\n');
			isSilence = false;
			sendData()

		}else{																		//just put it in box
			writeIn(toHMS(request.time - syncFix));
			if(cuts.length != 0) sendData()
		}
		
	}else if(request.message == "video_shot"){
		if(request.dataURI){
			screenShot.src = request.dataURI
		}else{
			showMsg(chrome.i18n.getMessage('badService'));
			shotFileBtn.style.display = '';
			autoBtn.style.display = 'none'
		}
		writeIn(toHMS(request.time - syncFix));						//insert time regardless
		setTimeout(makeTimeLabels,100)
		
	}else if(request.message == "autosync_done"){
		fineMode.checked = true;
		showMsg(chrome.i18n.getMessage('autosync_done'))

	}else if(request.message == "autosync_fail"){
		autoBtn.disabled = true;
		showMsg(chrome.i18n.getMessage('autosync_fail'))
		
	}else if(request.message == "are_you_there"){
		if(serviceName == request.serviceName) chrome.runtime.sendMessage({message: "popup_open"});
		setTimeout(function(){window.moveTo(0,0)},10)
	}
  }
)