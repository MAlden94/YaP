/*
Copyright (C) 2012-2016 Mitchell Lafferty <coolspeedy6 at gmail dot com>
Released under the GNU GPL.

YaP (Yet another Pong) is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

YaP is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with YaP. If not, see <http://www.gnu.org/licenses/>.

If you or someone else happens to edit/fork this code
I would love to see the improvement you/they made
to the code, so please email me if you wish to.

For any questions please email me.

What's included: pong.js, pong.css, pong.common.css, pong.alt*.css (get the files here or email me: http://linuxrules94.users.sf.net/)


Make sure you set your DOCTYPE to <!DOCTYPE html>
Add the following inside <head></head> and replace css/pong.css with the path of one of the css files included (pong.css [recommended], or pong.alt*.css):

<link href="css/pong.css" type="text/css" rel="stylesheet">
<script src="http://code.jquery.com/jquery-2.1.1.min.js"></script>
<script src="js/jquery.finger.js"></script>
<script src="js/pong.js"></script>
<script>
$(function(){
    Pong()
});
</script>


In order to allow the user to exit/pause game put these elements in the body somewhere accessible

  <button id="pong_pause_toggle"></button>
  <button id="pong_interactive_toggle"></button>
  
  and use the id "#pong_scroll_to" to make the window scroll to a menu (that contains the pong buttons),
    if not then window will scroll to "#pong_btn_group" or else "#pong_interactive_toggle".
  
"#pong_btn_group" will hide [child] elements unless pong is playable
    (and will scroll the window to the menu buttons, if #pong_scroll_to is not used)

Notes to self:
    TODO: Makefiles, uglify js
    TODO: Keyboard & touch/drag invert controls not yet implemented, Gyro invert untested.
    TODO: Need to allow user to change ball & paddle sizes, and vx/y, and keybinds
         (Level will adjust it for now, but we might want a initial size, or have a option to adjust individual things)
         (I could fix YaP_Object.Privates.ball_vx & YaP_Object.Privates.ball_vy by prefixing with init so Levels won't mess it up)

    TODO: Need to fix AI for DualPaddles when Interactive == false, so it is single player AI (fixed)
    TODO: Need to adapt for phones (done) (need to add double tap to exit)

    TODO: Need to add WebSocket support
          and multiplayer pvp or remote ctrl option
    TODO: Need to have a mobile gesture for pong menu.
    TODO: Maybe make pong menu stay open if no "#pong_scroll_to" or "#pong_interactive_toggle"
          is found and pong is interactive and page has been reloaded, or returned to by user
          (maybe make it possible to disable this feature as well?)
    TODO: Some of the YaP_Object.Settings really shouldn't be saved in a local config

    TODO: Look for a way to avoid location.reload() when resetting.
    TODO: Need a mouseSensitivity option (maybe use degreeOfMotion??)
   
    TODO: Document all bugs/features since intial branch push.
          (this will take forever since I neglected doing this
          from the start, and unfortunatly we may miss somethings)
   
    BUG:  Gyro does not work immediately, also calibrate doesn't exit on menu close. (latter is fixed)
    BUG:  Ball gets in way of content if pong is paused and page is reloaded, also pause is not sticking
          if button is triggered (maybe set a forced_pause var) (fixed, for now)
    BUG:  Menu won't show if exit/pause </button>'s are missing. (this is due to using a jQuery trigger)
    BUG:  Firefox CSS (text to button ratios wrong)
    
    TODO: Make ball vary in angle during bounce. (because otherwise AI/Player will just hover in same
          area to get ridiculous scores.)
    TODO: AI is too lazy/lax, needs to be more agressive at %50 (%50 shouldn't feel like 10% effort)
*/

/**
 * 
 * ///             No user serviceable parts below!                 \\\
 * /// Please use separate js files for user defined functionality. \\\
 * 
 **/

if (typeof jQuery === 'undefined')
{
    // Load jquery if user forgot to load it
    //console.warn('YaP: You forgot to load jQuery, Attempting to inject and fallback to jQuery 2.1.1!');
    document.write('<script src="http://code.jquery.com/jquery-2.1.1.min.js"></script>');
}

// Homemade jquery plugin to catch double keypress
// Need support for double tap
(function ($) {
    $.fn.doublekeypress = function (funcCall, deltaTime) {
	var lastKeyCode = null;
	var lastKeyTime = 0;
	if (!$.isNumeric(deltaTime)) {
	    deltaTime = 600;
	}
	return this.each(function () {
	    $(this).keypress(function (event) {
		var newKeyCode = event.which;
		////console.debug(String.fromCharCode((96 <= newKeyCode && newKeyCode <= 105)? newKeyCode-48 : newKeyCode));
		if (newKeyCode == lastKeyCode) {
		    var newKeyTime = Date.now();
		    ////console.debug(newKeyTime, ' - ', lastKeyTime, ' = ', newKeyTime - lastKeyTime, ' <= ', deltaTime)
		    if (newKeyTime - lastKeyTime <= deltaTime) {
			lastKeyCode = null;
			newKeyTime  = 0;
			return funcCall(event)
		    }
		    lastKeyTime = newKeyTime;
		}
		lastKeyCode = newKeyCode
	    })
	})
    }
})(jQuery);
// end

/**
* @brief This is for initializing the game, this is executed externally on the owner's webpage.
* @notes This is a singleton, it will only run once
* @return void
**/
var Pong = function()
{
    //console.group('YaP: ');
    Pong = function() {
	//console.warn('Pong already initalized! Returning YaP object')
	return YaP_Object
    }
    
    window.requestAnimationFrame = window.requestAnimationFrame       ||
				  window.webkitRequestAnimationFrame ||
				  window.mozRequestAnimationFrame    ||
				  window.oRequestAnimationFrame      ||
				  window.msRequestAnimationFrame     ||
				  function (callback, element) {
				      window.setTimeout(callback, 1000 / 60)
				  };
    
    if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = clearTimeout;


    var YaP_Object      = new Object();

    YaP_Object.Privates = new Object();
    YaP_Object.Privates.OldInputMethod   = null;
    YaP_Object.Privates.InputMethods     = [];
    YaP_Object.Privates.InputMethodNames = {
					      'mousemove'         : 'Mouse',
					    //'mousewheel'        : 'Mouse Wheel',
					      'keydown'           : 'Keyboard',
					      'touchstart'        : 'Touch',
					      'touchmove'         : 'Drag',
					      'deviceorientation' : 'Gyroscope'
					  };

    YaP_Object.Privates.LatestFrameLatency = 0;
    YaP_Object.Privates.SafeFrameLatency   = 300;
    YaP_Object.Privates.title              = document.title;

    YaP_Object.Privates.Blinker            = null;
    YaP_Object.Privates.FrameID            = null;
    YaP_Object.Privates.AI_Error           = 0;

    YaP_Object.Privates.AI_Depth           = 0;

    YaP_Object.Privates.p1_hit             = false; // Nasty kludge to workaround
    YaP_Object.Privates.p2_hit             = false; // bug with paddle collision check (need proper fix!)

    YaP_Object.Privates.P1InitSize         = 100;   // updated by Jquery Method in code
    YaP_Object.Privates.P2InitSize         = 100;   // ditto

    YaP_Object.Privates.ball_vy            = 5;     // velocity (also set by Level) (default =  5)
    YaP_Object.Privates.ball_vx            = 5;     // ditto

    YaP_Object.Settings = new Object();
    YaP_Object.Settings.Level                     = 5;           // Level (default =  5)
    YaP_Object.Settings.Player1Velocity           = 10;          // velocity for keyboard (default =  10)
    YaP_Object.Settings.Player2Velocity           = 10;          // ditto

    YaP_Object.Settings.AI_difficulty             = 50;          // 0 - 100 (default =  50)
    YaP_Object.Settings.AI_player                 = 2;           // 0 =  off  --- 1 =  P1 is cpu  /  2 =  P2 is cpu (default =  2)

    YaP_Object.Settings.degreeOfMotion            = 2;
    YaP_Object.Settings.GyroOffset                = [0, 0];

    YaP_Object.Settings.InputMethod               = 'deviceorientation'; // leave this as is (for mobile support)
    YaP_Object.Settings.DualPaddles               = false;       // default =  false
    YaP_Object.Settings.InvertControls            = false;       // default =  false

    YaP_Object.Settings.AutoLevelUp               = true;        // default =  true
    
    YaP_Object.Settings.Interactive               = false;       // default =  false
    YaP_Object.Settings.Menu                      = false;       // default =  false
    YaP_Object.Settings.Paused                    = false;       // default =  false
    YaP_Object.Settings.ForcedPause               = false;       // default =  false (for pause buttons)

    YaP_Object.Settings.MenuOnInteractiveReturn   = false;       // default =  false

    YaP_Object.Settings.LevelChangesPaddleSize    = true;        // default =  true
    YaP_Object.Settings.link_velocity_of_players  = true;        // default =  true

    YaP_Object.Settings.FixBoundaryBug            = false;       // default =  false
    
//    YaP_Object.Settings.MenuKeyDoublePress        = not yet implemented (for hotkeys)

    YaP_Object.Functions = new Object();



    // rather than calling these methods multiple times we set a varible to it's value to instead, to opimize for speed
    // and we reduce it to one call
    $(window).resize(function () {
	YaP_Object.Privates.window_height = $(window).height();
	YaP_Object.Privates.window_width  = $(window).width();
    }).resize();

    $('body').append('<div id="PongTable"></div>')
    $('#PongTable').append('<span id="P1Score">0</span>');
    $('#PongTable').append('<span id="P2Score">0</span>');
    $('#PongTable').append('<span id="P1" title="I can has turn?"></span>');
    $('#PongTable').append('<span id="P2" title="Muahahaha!"></span>');
    $('#PongTable').append('<span id="Ball" title="Ouch!"></span>');

    YaP_Object.Privates.$p1_score  = $('#PongTable #P1Score');
    YaP_Object.Privates.$p2_score  = $('#PongTable #P2Score');
    YaP_Object.Privates.$p1        = $('#PongTable #P1');
    YaP_Object.Privates.$p2        = $('#PongTable #P2');
    YaP_Object.Privates.$ball      = $('#PongTable #Ball');

    YaP_Object.Privates.P1InitSize = parseInt(YaP_Object.Privates.$p1.css('height'));
    YaP_Object.Privates.P2InitSize = parseInt(YaP_Object.Privates.$p2.css('height'));

    $.each(YaP_Object.Privates.InputMethodNames, function (index, value) {
	if ('on' + index in window) {
	  /**
	    * Lets find out if device* is accually supported
	    * by seeing if the value of event.* is valid
	    * if so add it to YaP_Object.Privates.InputMethods
	    **/
	    if(index == 'deviceorientation') {
		var test = function(event) {
		    if(event.alpha == null || event.beta == null ||  event.gamma == null) {
			$('#PongTable #_InputMethod option[value="' + index + '"]').remove();
			if (index == YaP_Object.Settings.InputMethod){
			  YaP_Object.Settings.InputMethod = 'mousemove';
			}
			//console.warn('Unsupported event detected:', index, ': InputMethod has been reset to mousemove, offending <option/> removed.');
		    }
		    window.removeEventListener(index, test, false);
		}
		window.addEventListener(index, test, false);
	    }
	    YaP_Object.Privates.InputMethods.push(index);

	}
    });

    $('#PongTable').dblclick(function () {
	// Allows user to exit interaction with pong game by double clicking on #PongTable (negative space).
	if (YaP_Object.Settings.Interactive) $('#pong_interactive_toggle').mouseup();
    }).on('doubletap',function() {
	$('#PongTable').dblclick();
    });

    $('#pong_btn_group').css('display', 'inline');

    $('#pong_pause_toggle').css('display', 'inline').mouseup(function () {
        // if Paused is false then Paused and ForcedPause are set true
	YaP_Object.Settings.ForcedPause = (YaP_Object.Settings.Paused = !YaP_Object.Settings.Paused);
	$(window).off('focus', YaP_Object.Functions.focus);
	if (!YaP_Object.Settings.Paused) {
	    $(window).on('focus', YaP_Object.Functions.focus);
	    YaP_Object.Settings.Menu = false;
	}
	YaP_Object.Functions.Update();
    });

    $('#pong_interactive_toggle').css('display', 'inline').mouseup(function (event) {
	YaP_Object.Settings.Interactive = !YaP_Object.Settings.Interactive;
	if (!YaP_Object.Settings.Interactive) {
	    YaP_Object.Settings.Menu = true;
	}
	YaP_Object.Functions.toggleMenu()
    });

  /**
    * @brief This is so we don't waste resources when tab or window isn't active
    * @notes
    * @return void
    **/
    YaP_Object.Functions.blur = function () {
	if (YaP_Object.Settings.Menu || YaP_Object.Settings.ForcedPause) return;
	YaP_Object.Settings.Paused = true;
	YaP_Object.Functions.Update();
	$(window).off('blur', YaP_Object.Functions.blur);
    };
    YaP_Object.Functions.focus = function () {
	if (YaP_Object.Settings.Menu || YaP_Object.Settings.ForcedPause) return;
	YaP_Object.Settings.Paused = false;
	YaP_Object.Functions.Update();
	$(window).on('blur', YaP_Object.Functions.blur);
    };
    $(window).on('focus', YaP_Object.Functions.focus);


    if (! YaP_Object.Settings.FixBoundaryBug) {
      for (i = 0; i <= (YaP_Object.Privates.window_height / 2)
		    && !YaP_Object.Settings.FixBoundaryBug; i++) {

	    YaP_Object.Privates.$ball.css('top', i + 'px');
	    YaP_Object.Settings.FixBoundaryBug = (
			      YaP_Object.Privates.window_height
		    - parseInt(YaP_Object.Privates.$ball.css('top'))
		    - parseInt(YaP_Object.Privates.$ball.css('height'))
		  != parseInt(YaP_Object.Privates.$ball.css('bottom'))
	    )
	}
    }

    if (YaP_Object.Settings.FixBoundaryBug){
      //console.info('Boundary bug detected!')
    }

    YaP_Object.Privates.$ball.css('left', YaP_Object.Privates.window_width  / 2 + 'px');
    YaP_Object.Privates.$ball.css('top',  YaP_Object.Privates.window_height / 2 + 'px');

    /// Menu start
    // I fsck hate using tables
    $('#PongTable').append('<div id="Menu">\
	<table>\
	  <tr>\
	      <td></td>\
	      <td><span id="blink" style="display: inline; text-align: center">Click outside the menu to close.</span></td>\
	      <td></td>\
	  </tr>\
	</table>\
	<table>\
	  <tr>\
	      <td>Level </td>\
	      <td><input id="_Level" max="100" min="1" type="number"></td>\
	      <td></td>\
	  </tr>\
	    <tr>\
		<td>\
		<select id="_AI_player">\
		    <option value="0">CPU: Off</option>\
		    <option value="2">CPU: P2</option>\
		    <option value="1">CPU: P1</option>\
		</select>\
		</td>\
		<td><input id="_AI_difficulty" max="100" min="0" type="number"></td>\
		<td>% difficulty</td>\
		<td></td>\
	    </tr>\
	    <tr>\
		<td>Input method</td>\
		<td id="degreeOfMotionlabel" style="display: none">&deg; Of Motion</td>\
		<td></td>\
	    </tr>\
	    <tr>\
	    <td><select id="_InputMethod"></select></td>\
	    <td><input id="_degreeOfMotion" max="360" min="0" type="number" style="display: none"></td>\
	    <td><button id="Calibrate">Calibrate</button></td>\
	    </td>\
	</table>\
	<table class="PlayerVelocity" style="display: none">\
	    <tr>\
		<td>P1</td>\
		<td></td>\
		<td>P2</td>\
	    </tr>\
	    <tr>\
		<td><input id="_Player1Velocity" max="100" min="1" type="number"></td>\
		<td><input id="_link_velocity_of_players" type="checkbox"></td>\
		<td><input id="_Player2Velocity" max="100" min="1" type="number"></td>\
		<td>velocity</td>\
	    </tr>\
	</table>\
	<hr>\
	<table>\
	<tr>\
	<td></td>\
	<td>\
	<input id="_DualPaddles"    type="checkbox">Dual Paddles<br>\
	<input id="_InvertControls" type="checkbox">Invert Controls<br>\
	<input id="_AutoLevelUp"    type="checkbox">Automatically Level up<br>\
	<input id="_Interactive"    type="checkbox">Interactive<br>\
	<input id="_Paused"         type="checkbox">Paused<br>\
	</td>\
	<td></td>\
	</tr>\
	</table>\
	<table>\
	<td><a id="ResetScores"   href="#">Reset scores</a></td>\
	<td></td>\
	<td><a id="ResetSettings" href="#">Default settings</a></td>\
	</tr>\
	</table>\
	<table>\
	<tr>\
	<td></td>\
	<td>+/-: Level | A/Z: P1 | J/M: P2 | <a id="Info" href="#">Info</a></td>\
	<td></td>\
	</tr>\
	</table>\
	</div><div id="About">Copyright (C) 2012-2016 Mitchell Lafferty &lt;<a href="http://linuxrules94.users.sf.net/">http://linuxrules94.users.sf.net/</a>&gt; <coolspeedy6 at gmail dot com><br>\
	Released under the GNU GPL.<br>\
	Please read the source code for more info. (pong.js)<br>\
	<a id="MyBitcoin" href="bitcoin:16tpxvjpPKhMUGhZkRU9s9UhuKZMuFBVfz?label=Donations%20Address%20for%20linuxrules94"><em>Bitcoin donations :)</em></a></div>');

    $.each(YaP_Object.Privates.InputMethods, function (index, value) {
	// $.inArray doesn't work here because typeof InputMethodNames === 'object'
	$('#PongTable #_InputMethod').append($('<option/>', {
	    value:  value,
	    text: ( YaP_Object.Privates.InputMethodNames[value] !== undefined)
		  ? YaP_Object.Privates.InputMethodNames[value] : value
	}))
    });

    $('#PongTable').find('#_AI_player, #_degreeOfMotion, #_AI_difficulty').change(function () {
	YaP_Object.Settings[this.id.substr(1)] = parseInt(this.value);
    }).keyup(function () {
	$(this).change()
    });

    $('#PongTable #_InputMethod').change(function () {
	$('#PongTable').find('.PlayerVelocity, #_degreeOfMotion, #degreeOfMotionlabel, #Calibrate').hide();
	switch (this.value) {
	    case 'deviceorientation':
		$('#PongTable').find('#_degreeOfMotion, #degreeOfMotionlabel, #Calibrate').show();
		break;
	    case 'keydown':
		$('#PongTable .PlayerVelocity').show();
		break;
	    default:
		if (YaP_Object.Privates.InputMethodNames[this.value] == undefined){
		    $(this).val(YaP_Object.Settings.InputMethod);
		    //console.warn('InputMethod not found, <select/> has been reset to ', YaP_Object.Settings.InputMethod);
		}
	        break;
	}
	YaP_Object.Settings.InputMethod = this.value;
    });

    $('#PongTable').find('#_Level, #_Player1Velocity, #_Player2Velocity').change(function () {
	YaP_Object.Settings[this.id.substr(1)] = this.value = ($.isNumeric(this.value)) ? this.value : YaP_Object.Settings[this.id.substr(1)];
	if (YaP_Object.Settings.link_velocity_of_players) {
	    switch (this.id) {
		case '_Player1Velocity':
		    if ( YaP_Object.Settings.link_velocity_of_players) {
			$('#PongTable #_Player2Velocity').val(YaP_Object.Settings.Player2Velocity = YaP_Object.Settings.Player1Velocity);
		    }
		    return;
		case '_Player2Velocity':
		    if ( YaP_Object.Settings.link_velocity_of_players) {
			$('#PongTable #_Player1Velocity').val(YaP_Object.Settings.Player1Velocity = YaP_Object.Settings.Player2Velocity);
		    }
		    return;
		case '_Level':
		    YaP_Object.Functions.UpdateLevel(2);
		    return;
	    }
	}
    }).keyup(function () {
	$(this).change()
    });

    $('#PongTable input[type="checkbox"]').click(function () {
	YaP_Object.Settings[this.id.substr(1)]  = this.checked;
	switch (this.id) {
	    case '_Paused':
		if (this.checked) {
		    YaP_Object.Settings.Menu = false;
		    YaP_Object.Functions.Update();
		}
		return;
	    case '_DualPaddles':
		$('#PongTable #_AI_player').attr('disabled', this.checked);
		return;
	}
    });

    $('#PongTable').find('#Calibrate, #ResetScores, #ResetSettings, #Info').click(function (event) {
	event.preventDefault();
	switch (this.id) {
	    case 'Calibrate':
		if($('#PongTable #Calibrate').text().indexOf('Confirm') != -1) {
		    $('#PongTable #Calibrate').text('Calibrate');
		}
		else {
		    $('#PongTable #Calibrate').text('Confirm');
		}
		return;
	    case 'ResetScores':
		YaP_Object.Privates.$p1_score.add(YaP_Object.Privates.$p2_score).text(0);
		//console.info('Player scores have been reset by user.');
		return;
	    case 'ResetSettings':
		localStorage.clear();
		location.reload();
		//console.info('LocalStorage has been reset by user.');
		return;
	    case 'Info':
		$('#About').slideToggle(1000);
		return;
	}
    });

    $('#PongTable').find('#Menu, #About').each(function() {
	$(this).css({
	    'margin-left': -$(this).outerWidth()  / 2 + 'px',
	    'margin-top':  -$(this).outerHeight() / 2 + 'px'
	}).click(function (event) {
	    event.stopPropagation() // why is this here?
	    if (this.id == 'About') $(this).fadeOut(1000);
	}).fadeOut(0);
    });

    $('#PongTable #Menu').dblclick(function (event) {
	// Prevent accidental close of our menu if user double clicks
        //     it or it's children (ie: clicking a spinbox very fast)
	event.stopPropagation();
    }).on('doubletap',function (event) {
	event.stopPropagation();
    });


    $('body').click(function (event) {
	// Keep our menu open if user clicks on the webpage's menu
	//   (might make separate css selector like "pong-keep-open" or "pong-ignore") (not working on mobile)
        console.debug('Body click: ', event, 'on: ', event.target, 'Interactive: ', YaP_Object.Settings.Interactive);
	if ($(event.target).is('a') || $(event.target).is('button') || $(event.target).is('span')) return;
	if (YaP_Object.Settings.Menu) {
	    YaP_Object.Functions.toggleMenu();
	    $('#PongTable #About').fadeOut(1000);
	}
    });

    /// Menu end

    if (typeof Storage !== 'undefined') {
	//console.group('Reading LocalStorage[*]:');
	for (param in YaP_Object.Settings) {
	    if (localStorage[param] === undefined) {
		//console.log("\t\tSkipping localStorage[", param, "] == undefined");
		continue;
	    }
	    //console.log("\t\t(YaP_Object.Settings[", param, "], ", YaP_Object.Settings[param],") = (localStorage[", param, "], ", localStorage[param], ')');
	    try {
		YaP_Object.Settings[param] = JSON.parse(localStorage[param]);
	    }
	    catch (e) {
		//console.warn("\t\tSkipping: localStorage[", param, "]: Error:",e);
	    }
	}
	//console.groupEnd();
    }

    // This is encapulated in a function because $(document).keypress(...GlobalKeyboardHandler); does not work
    $(document).keypress(function (event) {
	YaP_Object.Functions.GlobalKeyboardHandler(event)
    });

    $(document).doublekeypress(function (event) {
	if (event.which == 112) YaP_Object.Functions.toggleMenu()
    }); // p key = pause NOTE: replace 112 with a constant or Settings.*

  /**
    * @brief This sets the params and saves them
    * @notes
    * @return void
    **/
    YaP_Object.Functions.Update = function() {
	if (YaP_Object.Settings.Menu) {
	    $('#PongTable #_Level').val(YaP_Object.Settings.Level);
	    $('#PongTable #_Player1Velocity').val(YaP_Object.Settings.Player1Velocity);
	    $('#PongTable #_Player2Velocity').val(YaP_Object.Settings.Player2Velocity);
	    $('#PongTable #_AI_difficulty').val(YaP_Object.Settings.AI_difficulty);
	    $('#PongTable #_AI_player').val(YaP_Object.Settings.AI_player);
	    $('#PongTable #_InputMethod').val(YaP_Object.Settings.InputMethod).change();
	    $('#PongTable #_degreeOfMotion').val(YaP_Object.Settings.degreeOfMotion);
	    $('#PongTable #_DualPaddles').attr('checked', YaP_Object.Settings.DualPaddles);
	    $('#PongTable #_AutoLevelUp').attr('checked', YaP_Object.Settings.AutoLevelUp);
	    $('#PongTable #_Interactive').attr('checked', YaP_Object.Settings.Interactive);
	    $('#PongTable #_Paused').attr('checked', false);
	    $('#PongTable #_AI_player').attr('disabled', YaP_Object.Settings.DualPaddles);
	    $('#PongTable #_link_velocity_of_players').attr('checked',  YaP_Object.Settings.link_velocity_of_players);

	    $('#PongTable #Menu').slideDown(1000);

	    if (!YaP_Object.Privates.Blinker) {
		YaP_Object.Privates.Blinker = setInterval(function () {
		    $('#PongTable #blink').fadeToggle(500)
		}, 500);
	    }
	}
	else {
	    clearInterval(YaP_Object.Privates.Blinker);
	    YaP_Object.Privates.Blinker = null;
	    // Exit calibration and menu
	    $('#PongTable #Calibrate').text('Calibrate');
	    $('#PongTable #Menu, #About').fadeOut(500);
	}

	YaP_Object.Functions.UpdateLevel(2);

	$('#pong_menu_toggle').text((YaP_Object.Settings.Menu               ? 'close' : 'open') + ' pong menu');
	$('#pong_pause_toggle').text((YaP_Object.Settings.Paused            ? 'play' : 'pause') + ' pong');
	$('#pong_interactive_toggle').text((YaP_Object.Settings.Interactive ? 'quit' : 'start') + ' pong');

	if (YaP_Object.Settings.Interactive) {
	    if (YaP_Object.Settings.MenuOnInteractiveReturn){
		YaP_Object.Settings.Menu = true;
	    }
	    if(!$('#PongTable').hasClass('interactive')) {
		$('#PongTable').addClass('interactive');
	    }
	}
	else {
	    $('#PongTable').removeClass('interactive');
	}

	switch (YaP_Object.Privates.OldInputMethod) {
	    case 'deviceorientation':
	    case 'touchstart':
	    case 'touchend':
	    case 'touchmove':
		window.removeEventListener(YaP_Object.Settings.InputMethod, YaP_Object.Functions.EventHandler);
		break;
	    default:
		$(window).off(YaP_Object.Privates.OldInputMethod,  YaP_Object.Functions.EventHandler)
	}

	if (jQuery.inArray(YaP_Object.Settings.InputMethod, YaP_Object.Privates.InputMethods) == -1) {
	    //console.warn('InputMethod:', YaP_Object.Settings.InputMethod, ': not found using: ', YaP_Object.Privates.InputMethods[0], ' input instead');
	    YaP_Object.Settings.InputMethod = YaP_Object.Privates.InputMethods[0];
	}

	if (YaP_Object.Settings.Interactive) {
	    //console.info('InputMethod selected:', YaP_Object.Settings.InputMethod);
	    YaP_Object.Privates.OldInputMethod = YaP_Object.Settings.InputMethod;
	    switch (YaP_Object.Privates.OldInputMethod) {
		case 'deviceorientation':
		case 'touchstart':
		case 'touchend':
		case 'touchmove':
		    window.addEventListener(YaP_Object.Settings.InputMethod, YaP_Object.Functions.EventHandler);
		    break;
		default:
		    $(window).on(YaP_Object.Settings.InputMethod,  YaP_Object.Functions.EventHandler)
	    }
	}

	if (YaP_Object.Settings.DualPaddles) {
	    YaP_Object.Settings.AI_player = 0;
	}

	if (!YaP_Object.Settings.Paused) {
	    if (!YaP_Object.Privates.FrameID) {
		YaP_Object.Privates.FrameID = window.requestAnimationFrame(YaP_Object.Functions._newframe);
	    }
	}
	else {
	    if (YaP_Object.Settings.ForcedPause){
	        YaP_Object.Privates.$ball.css( {
	        'top':  50  + 'px', // TODO: ANIMATE
	        'left': 20  + 'px',
	        });
                YaP_Object.Privates.$p2.css('top',
                    YaP_Object.Privates.window_height
                    - parseInt(YaP_Object.Privates.$p2.css('height'))
                );
	    }
	    window.cancelAnimationFrame(YaP_Object.Privates.FrameID);
	    YaP_Object.Privates.FrameID = null;
	}

	if (typeof Storage !== 'undefined') {
	    //console.group('Writing LocalStorage[*]:');
	    for (param in YaP_Object.Settings) {
		//console.log("\t\t(localStorage[", param, "], ", localStorage[param],") = (YaP_Object.Settings[", param, "], ", YaP_Object.Settings[param], ')');
		try {
		    localStorage[param] = JSON.stringify(YaP_Object.Settings[param]);
		}
		catch (e) {
		    //console.warn("\t\tSkipping: YaP_Object.Settings[", param, "]: Error:", e);
		}
	    }
	    //console.groupEnd();
	}
    }

  /**
    * @brief This is for toggling the config Menu
    * @notes
    * @return true if Paused
    **/
    YaP_Object.Functions.toggleMenu = function () {
	// if Menu is false then Menu and Paused are set true
	YaP_Object.Settings.Paused = (YaP_Object.Settings.Menu = !YaP_Object.Settings.Menu);

	if (YaP_Object.Settings.Menu) {
	    YaP_Object.Settings.Interactive = true;

	    if ($('#pong_scroll_to').length){
		//console.debug('Found #pong_scroll_to @ ', $('#pong_scroll_to').position().top);
		window.scrollTo(0, $('#pong_scroll_to').position().top)
	    } else if ($('#pong_btn_group').length){
		//console.debug('Found #pong_btn_group @ ', $('#pong_btn_group').position().top);
		window.scrollTo(0, $('#pong_btn_group').position().top)
	    } else {
		window.scrollTo(0, $('#pong_interactive_toggle').position().top)
		//console.debug('Found #pong_interactive_toggle @ ', $('#pong_interactive_toggle').position().top);
	    }
	}
	
	YaP_Object.Functions.Update();
	return YaP_Object.Settings.Menu
    }

  /**
    * @brief This is for changing the speed and level
    * @notes
    * @return void
    **/
    YaP_Object.Functions.UpdateLevel = function(mode) {

	switch (mode) {
	    case 0:
		YaP_Object.Settings.Level++;
		break;
	    case 1:
		YaP_Object.Settings.Level--;
		break;
	    default:
		//console.info('Updating level only, not changing number.')
	}

	YaP_Object.Settings.Level = constrain(YaP_Object.Settings.Level, 1, 100);

	//if (YaP_Object.Settings.LevelChangesBallSpeed) {
	YaP_Object.Privates.ball_vy = (YaP_Object.Privates.ball_vy < 0 ? -1 : 1) * YaP_Object.Settings.Level;
	YaP_Object.Privates.ball_vx = (YaP_Object.Privates.ball_vx < 0 ? -1 : 1) * YaP_Object.Settings.Level;
	//}

	if (YaP_Object.Settings.LevelChangesPaddleSize) {
	    YaP_Object.Privates.$p1.css('height', constrain(Math.ceil(YaP_Object.Privates.P1InitSize - ((YaP_Object.Settings.Level * 2.5) / 100) * YaP_Object.Privates.P1InitSize), 15, YaP_Object.Privates.P1InitSize) + 'px');
	    YaP_Object.Privates.$p2.css('height', constrain(Math.ceil(YaP_Object.Privates.P2InitSize - ((YaP_Object.Settings.Level * 2.5) / 100) * YaP_Object.Privates.P2InitSize), 15, YaP_Object.Privates.P2InitSize) + 'px');
	}

	if (YaP_Object.Settings.Interactive) {
	    // Put 'Pong Level: ' in a 'YaP_Object.Privates.'?
	    document.title = 'Pong Level: ' + YaP_Object.Settings.Level; // YaP_Object.Privates.title +
	}
	else {
	    document.title = YaP_Object.Privates.title;
	}
    }

  /**
    * @brief This is our animation loop
    * @notes
    * @return void
    **/
    YaP_Object.Functions._newframe = function () {
      
	if (!YaP_Object.Settings.Paused) {
	    window.requestAnimationFrame(YaP_Object.Functions._newframe);
	}

	var start = (new Date()).getMilliseconds();

	if (YaP_Object.Settings.FixBoundaryBug) {
	    YaP_Object.Privates.$p1.css('bottom',   (YaP_Object.Privates.window_height - parseInt(YaP_Object.Privates.$p1.css('top')   )) - parseInt(YaP_Object.Privates.$p1.css('height')  ) + 'px');
	    YaP_Object.Privates.$p2.css('bottom',   (YaP_Object.Privates.window_height - parseInt(YaP_Object.Privates.$p2.css('top')   )) - parseInt(YaP_Object.Privates.$p2.css('height')  ) + 'px');
	    YaP_Object.Privates.$ball.css('bottom', (YaP_Object.Privates.window_height - parseInt(YaP_Object.Privates.$ball.css('top') )) - parseInt(YaP_Object.Privates.$ball.css('height')) + 'px');
	    YaP_Object.Privates.$ball.css('right',  (YaP_Object.Privates.window_width  - parseInt(YaP_Object.Privates.$ball.css('left'))) - parseInt(YaP_Object.Privates.$ball.css('width') ) + 'px');
	}

	// Rather than calling these methods multiple times we set a varible to it's value to instead,and we reduce it to one call to optimize for speed
	ball_top    = parseInt(YaP_Object.Privates.$ball.css('top'));
	ball_bottom = parseInt(YaP_Object.Privates.$ball.css('bottom'));
	ball_left   = parseInt(YaP_Object.Privates.$ball.css('left'));
	ball_right  = parseInt(YaP_Object.Privates.$ball.css('right'));

	p1_top     = parseInt(YaP_Object.Privates.$p1.css('top'));
	p1_bottom  = parseInt(YaP_Object.Privates.$p1.css('bottom'));
	p1_left    = parseInt(YaP_Object.Privates.$p1.css('left'));
	p1_width   = parseInt(YaP_Object.Privates.$p1.css('width'));
	p1_height  = parseInt(YaP_Object.Privates.$p1.css('height'));

	p2_top     = parseInt(YaP_Object.Privates.$p2.css('top'));
	p2_bottom  = parseInt(YaP_Object.Privates.$p2.css('bottom'));
	p2_right   = parseInt(YaP_Object.Privates.$p2.css('right'));
	p2_width   = parseInt(YaP_Object.Privates.$p2.css('width'));
	p2_height  = parseInt(YaP_Object.Privates.$p2.css('height'));

	//if (YaP_Object.Settings.Interactive && !YaP_Object.Settings.DualPaddles) {  // && (YaP_Object.Settings.AI_player
	if (!YaP_Object.Settings.Interactive) {
	    YaP_Object.Settings.AI_player = (YaP_Object.Privates.ball_vx < 0) ? 1 : 2;
	}

	if ((YaP_Object.Settings.AI_player == 1
	    && YaP_Object.Privates.ball_vx < 0
	    && ball_left  < YaP_Object.Privates.AI_Depth)
	|| (YaP_Object.Settings.AI_player == 2
	    && YaP_Object.Privates.ball_vx > 0
	    && ball_right < YaP_Object.Privates.AI_Depth)) {

	    var AI_vy = 1;
	    var AI_ID = YaP_Object.Privates.$p1;
	    if (YaP_Object.Settings.AI_player == 1){
	        if(YaP_Object.Settings.InputMethod == 'keydown'){
	            AI_vy = YaP_Object.Settings.Player1Velocity;
                }
	    } else {
	        if(YaP_Object.Settings.InputMethod == 'keydown'){
	            AI_vy = YaP_Object.Settings.Player2Velocity;
                }
                AI_ID = YaP_Object.Privates.$p2;
	    }

	    if (YaP_Object.Settings.DualPaddles) {
                AI_ID = YaP_Object.Privates.$p1.add(YaP_Object.Privates.$p2);
	    }

	    var ball_pos = ball_top - ((parseInt($(AI_ID).css('height')) / 2) + YaP_Object.Privates.AI_Error) * (YaP_Object.Privates.ball_vy < 0 ? -1 : 1);

	    if (YaP_Object.Privates.ball_vy < 0) {
		for (i = parseInt($(AI_ID).css('top')); i >= ball_pos; i -= AI_vy) {
		    $(AI_ID).css('top', i + 'px');
		}
	    }
	    else {
		for (i = parseInt($(AI_ID).css('top')); i <= ball_pos; i += AI_vy) {
		    $(AI_ID).css('top', i + 'px');
		}
	    }
	    if (parseInt($(AI_ID).css('top')) + parseInt($(AI_ID).css('height')) > YaP_Object.Privates.window_height) {
		$(AI_ID).css('top',
			      (YaP_Object.Privates.window_height
			      - parseInt($(AI_ID).css('height')))
			      + 'px');
	    }
	    if (parseInt($(AI_ID).css('top')) < 0) $(AI_ID).css('top', '0px');
	}
	//}
	if (ball_top <= Math.abs(YaP_Object.Privates.ball_vy) || ball_bottom <= Math.abs(YaP_Object.Privates.ball_vy)) {
	    YaP_Object.Privates.ball_vy *= -1;
	}

	if (!YaP_Object.Privates.p2_hit
	   && ball_top    + Math.abs(YaP_Object.Privates.ball_vy) >= p2_top
	   && ball_bottom + Math.abs(YaP_Object.Privates.ball_vy) >= p2_bottom
	   && ball_right  - Math.abs(YaP_Object.Privates.ball_vx) <= p2_right + p2_width) {

	    if (!YaP_Object.Settings.DualPaddles) {
		YaP_Object.Privates.$p2_score.text(parseInt(YaP_Object.Privates.$p2_score.text()) + 1);
	    }
	    else {
		YaP_Object.Privates.$p1_score.text(parseInt(YaP_Object.Privates.$p1_score.text()) + 1);
	    }
	    YaP_Object.Privates.ball_vx *= -1;
	    if (YaP_Object.Settings.AI_player == 2 || !YaP_Object.Settings.Interactive) {
		YaP_Object.Functions.SetAI_Error(p1_height);
	    }
	    YaP_Object.Privates.p1_hit = false;
	    YaP_Object.Privates.p2_hit = true;
	    if (YaP_Object.Settings.AutoLevelUp && !(parseInt(YaP_Object.Privates.$p1_score.text()) ^ 5)){
	      YaP_Object.Functions.UpdateLevel(0);
	    }
	}
	else {
	    if (ball_right <= Math.abs(YaP_Object.Privates.ball_vx)) {
		if (YaP_Object.Settings.AI_player == 2 || !YaP_Object.Settings.Interactive) {
		    YaP_Object.Functions.SetAI_Error(p2_height);
		}
		if (!YaP_Object.Settings.DualPaddles) {
		    YaP_Object.Privates.$p1_score.text(parseInt(YaP_Object.Privates.$p1_score.text()) + 1);
		}
		else {
		    YaP_Object.Privates.$p2_score.text(parseInt(YaP_Object.Privates.$p2_score.text()) + 1);
		}
		// need to add serve code here
		ball_left = YaP_Object.Privates.window_width  / 2;
		ball_top  = YaP_Object.Privates.window_height / 2;
		YaP_Object.Privates.p1_hit = false;
		YaP_Object.Privates.p2_hit = false;
		if (YaP_Object.Settings.AutoLevelUp) {
		    YaP_Object.Functions.UpdateLevel(YaP_Object.Settings.Level = 0);
		}
	    }
	}
	if (!YaP_Object.Privates.p1_hit
	&& ball_top    + Math.abs(YaP_Object.Privates.ball_vy) >= p1_top
	&& ball_bottom + Math.abs(YaP_Object.Privates.ball_vy) >= p1_bottom
	&& ball_left   - Math.abs(YaP_Object.Privates.ball_vx) <= p1_left + p1_width) {

	    YaP_Object.Privates.$p1_score.text(parseInt(YaP_Object.Privates.$p1_score.text()) + 1);
	    YaP_Object.Privates.ball_vx *= -1;
	    if (YaP_Object.Settings.AI_player == 1 || !YaP_Object.Settings.Interactive) {
		YaP_Object.Functions.SetAI_Error(p2_height);
	    }
	    YaP_Object.Privates.p1_hit = true;
	    YaP_Object.Privates.p2_hit = false;
	    if (YaP_Object.Settings.AutoLevelUp && !(parseInt(YaP_Object.Privates.$p1_score.text()) ^ 5)) YaP_Object.Functions.UpdateLevel(0);
	}
	else {
	    if (ball_left <= Math.abs(YaP_Object.Privates.ball_vx)) {
		if (YaP_Object.Settings.AI_player == 1 || !YaP_Object.Settings.Interactive) {
		    YaP_Object.Functions.SetAI_Error(p1_height);
		}
		YaP_Object.Privates.$p2_score.text(parseInt(YaP_Object.Privates.$p2_score.text()) + 1);
		ball_left = YaP_Object.Privates.window_width  / 2;
		ball_top  = YaP_Object.Privates.window_height / 2;
		if (YaP_Object.Settings.AutoLevelUp) {
		    YaP_Object.Functions.UpdateLevel(YaP_Object.Settings.Level = 0);
		}
		YaP_Object.Privates.p1_hit = false;
		YaP_Object.Privates.p2_hit = false;
	    }
	}

	ball_top  += YaP_Object.Privates.ball_vy;
	ball_left += YaP_Object.Privates.ball_vx;

	// Reduced to one call for speed
	YaP_Object.Privates.$ball.css( {
	    'top':  ball_top  + 'px',
	    'left': ball_left + 'px',
	});
	//document.title = performance.now() - step;
	if ((YaP_Object.Privates.LatestFrameLatency = (new Date()).getMilliseconds() - start) > YaP_Object.Privates.SafeFrameLatency) {
	    if (YaP_Object.Settings.Interactive) {
		YaP_Object.Settings.Interactive = false;
		alert('Pong has been paused because it may freeze or slow down browser. Consider upgrading browser or computer if possible.');
	    }
	    else {
		//console.warn('Pong has been paused because it may freeze or slow down browser. Consider upgrading browser or computer if possible.');
	    }
	    $('#pong_pause_toggle').mouseup();
	    // The below method seems unreliable so *.mouseup is being used for now.
	    //YaP_Object.Settings.Paused = true;
	    //YaP_Object.Functions.Update();
	}

    }

  /**
    * @brief This is our dice roll for the error margin
    * @notes
    * @return void
    **/
    YaP_Object.Functions.SetAI_Error = function (player_height) {
	YaP_Object.Privates.AI_Error = Math.random() * (2 * player_height * (1 - (YaP_Object.Settings.AI_difficulty / 100))) * (Math.random() > 0.5 ? 1 : -1);
	YaP_Object.Privates.AI_Depth = Math.random() * YaP_Object.Privates.window_width * (YaP_Object.Settings.AI_difficulty / 100);
	//do {
	//YaP_Object.Privates.ball_vx  += Math.random() * (YaP_Object.Privates.ball_vx > 0 ? 1 : -1);
	//YaP_Object.Privates.ball_vy  += Math.random() * (YaP_Object.Privates.ball_vy > 0 ? 1 : -1);
	//} while (YaP_Object.Privates.ball_vx == 0 || YaP_Object.Privates.ball_vy == 0)
    }
  /**
    * @brief  This is for linking * events to paddles
    * @notes  ...
    * @return true
    **/
    YaP_Object.Functions.EventHandler = function (event) {
        //console.debug('EventHandler: ', event, 'InputMethod: ', YaP_Object.Settings.InputMethod, 'Interactive: ', YaP_Object.Settings.Interactive);
        if (!YaP_Object.Settings.Interactive || event.type != YaP_Object.Settings.InputMethod) return;
            switch (event.type) {
                case 'keydown':
                    return YaP_Object.Functions.KeyboardHandler(event);
                case 'mousemove':
                case 'onwheel':
                    return YaP_Object.Functions.MouseHandler(event);
                case 'touchstart':
                case 'touchmove':
                case 'touchend':
                    return YaP_Object.Functions.TouchHandler(event);
                case 'deviceorientation':
                    return YaP_Object.Functions.deviceorientationHandler(event);
        }
    }

  /**
    * @brief This is for linking gyro to paddles
    * @notes
    * @return true
    **/
    YaP_Object.Functions.deviceorientationHandler = function (event) {
        //console.debug('deviceorientationHandler: ', event);
        if (event.gamma == null || event.beta == null) {
            //console.warn('Unsupported event detected: InputMethod has been reset to mousemove, offending <option/> removed.');
            $('#PongTable #_InputMethod option[value="deviceorientation"]').remove();
            YaP_Object.Settings.InputMethod = 'mousemove';
            YaP_Object.Functions.Update();
            return true;
        }


        if ($('#PongTable #Calibrate').text().indexOf('Confirm') != -1) {
            index = (Math.abs(window.orientation) == 90) + 0; // Type conversion true = 1, etc.
            YaP_Object.Settings.GyroOffset[index] = index ? event.gamma : event.beta;
            $('#PongTable #Calibrate').text('Confirm [' + pad(parseInt(YaP_Object.Settings.GyroOffset[index]), 4) + ']');
            return;
       }

        if (YaP_Object.Settings.DualPaddles) {
            var $real_player = YaP_Object.Privates.$p1.add(YaP_Object.Privates.$p2);
        }
        else {
            var $real_player = (YaP_Object.Settings.AI_player == 2) ? YaP_Object.Privates.$p1 : YaP_Object.Privates.$p2;
        }

        $real_player.css('top', map(
			    constrain(
				( Math.abs(window.orientation) == 90)
				? (event.gamma - YaP_Object.Settings.GyroOffset[1]) * ( (YaP_Object.Settings.InvertControls) ? -1 : 1)
				: (event.beta  - YaP_Object.Settings.GyroOffset[0]) * ( (YaP_Object.Settings.InvertControls) ? -1 : 1),
				
		               -YaP_Object.Settings.degreeOfMotion,
		                YaP_Object.Settings.degreeOfMotion
			    ),
			    -YaP_Object.Settings.degreeOfMotion,
			     YaP_Object.Settings.degreeOfMotion,
			    0, (YaP_Object.Privates.window_height - parseInt($real_player.css('height')))
			) + 'px');
	return true;
    }

  /**
    * @brief This is for linking touch events to paddles
    * @notes half of screen allocated to P1, other half P2
    * @return true
    **/
    YaP_Object.Functions.TouchHandler = function (event) {
        //console.debug('TouchHandler: ', event);
        if (event.type == 'touchmove'){ // don't interfere with clicks
	    event.preventDefault();
	}
	var $real_player = null;
	if  (YaP_Object.Settings.DualPaddles) {
	    $real_player = YaP_Object.Privates.$p1.add(YaP_Object.Privates.$p2);
	}
	else {
	    if (YaP_Object.Settings.AI_player > 0) {
		$real_player = (YaP_Object.Settings.AI_player == 2) ? YaP_Object.Privates.$p1 : YaP_Object.Privates.$p2;
	    }
	    else {
		$real_player = (event.touches[0].pageX < YaP_Object.Privates.window_width / 2) ? YaP_Object.Privates.$p1 : YaP_Object.Privates.$p2;
	    }
	}
	$real_player.css('top',constrain(
			    (event.touches[0].pageY -
			      $(document).scrollTop()) - (parseInt($real_player.css('height')) / 2),
			    0 , (YaP_Object.Privates.window_height - parseInt($real_player.css('height')))
			) + 'px');
	return true;
    }

  /**
    * @brief This is for linking mouse to paddles
    * @notes half of screen allocated to P1, other half P2
    * @return true
    **/
    YaP_Object.Functions.MouseHandler = function (event) {
        //console.debug('MouseHandler: ', event);
	if (YaP_Object.Settings.DualPaddles) {
	    var $real_player = YaP_Object.Privates.$p1.add(YaP_Object.Privates.$p2);
	}
	else {
	    if (YaP_Object.Settings.AI_player > 0) {
		$real_player = (YaP_Object.Settings.AI_player == 2) ? YaP_Object.Privates.$p1 : YaP_Object.Privates.$p2;
	    }
	    else {
		$real_player = (event.pageX < YaP_Object.Privates.window_width / 2) ? YaP_Object.Privates.$p1 : YaP_Object.Privates.$p2;
	    }
	}
	var PageY = (YaP_Object.Settings.InvertControls) ? YaP_Object.Privates.window_height - (event.pageY - $(document).scrollTop()) : event.pageY - $(document).scrollTop();
	  $real_player.css('top', constrain(
	    Math.round(
	           PageY                             - (parseInt($real_player.css('height')) / 2)
	    ), 0 , YaP_Object.Privates.window_height -  parseInt($real_player.css('height'))
	  ) + 'px');
	return true;
    }

  /**
    * @brief This is for linking keyboard to paddles
    * @notes
    * @return true
    **/
    YaP_Object.Functions.KeyboardHandler = function (event) {
        //console.debug('KeyboardHandler: ', event);

	p1_top    = parseInt(YaP_Object.Privates.$p1.css('top'));
	p1_bottom = parseInt(YaP_Object.Privates.$p1.css('bottom'));

	p2_top    = parseInt(YaP_Object.Privates.$p2.css('top'));
	p2_bottom = parseInt(YaP_Object.Privates.$p2.css('bottom'));

	switch (event.which) {
	    case 65:
		// a
		if (YaP_Object.Settings.AI_player == 1) return;
		if (p1_top > 0) {
		    p1_top -= YaP_Object.Settings.Player1Velocity;
		}
		break;
	    case 90:
		// z
		if (YaP_Object.Settings.AI_player == 1) return;
		if (p1_bottom > 0) {
		    p1_top += YaP_Object.Settings.Player1Velocity
		}
		break;
	    case 74:
		// j
		if (YaP_Object.Settings.AI_player == 2) return;
		if (p2_top > 0) {
		  p2_top    -= YaP_Object.Settings.Player2Velocity;
		}
		break;
	    case 77:
		// m
		if (YaP_Object.Settings.AI_player == 2) return;
		if (p2_bottom > 0) {
		    p2_top += YaP_Object.Settings.Player2Velocity
		}
		break;
	}

	if (YaP_Object.Settings.DualPaddles) {
	    p1_top = p2_top;
	}
	
	YaP_Object.Privates.$p1.css( {
	    'top': p1_top + 'px',
	});
	YaP_Object.Privates.$p2.css( {
	    'top': p2_top + 'px',
	});

	return true;
    }

    YaP_Object.Functions.GlobalKeyboardHandler = function (event) {
        //console.debug('GlobalKeyboardHandler: ', event);
	if (!YaP_Object.Settings.Interactive) return;
	switch (event.which) {
	    case 43:
	    case 61:
		// +/=
		YaP_Object.Functions.UpdateLevel(0);
		break;
	    case 45:
		// -
		YaP_Object.Functions.UpdateLevel(1);
		break;
	}
	return true;
    }

  /**
    * @brief constrains values to lbound..ubound
    * @notes
    * @return result
    **/
    function constrain(value, min, max) {
	if(value < min) {
	    return min;
	}
	else if(value > max) {
	    return max;
	}
	return value;
    }

  /**
    * @brief maps values to inMin..inMax to outMin..outMax
    * @notes
    * @return result
    **/
    function map(value, inMin, inMax, outMin, outMax) {
	return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

  /**
    * @brief left pads strings
    * @notes min is the min length required
    * @return string
    **/
    function pad(str, min) {
	str = str.toString();
	return str.length < min ? pad(str + ' ', min) : str;
    }

    YaP_Object.Functions.Update();
    
    //console.groupEnd();
    return YaP_Object

}