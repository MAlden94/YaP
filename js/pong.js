/*
Copyright (C) 2012-2013 Mitchell Lafferty <coolspeedy6 at gmail dot com>
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

What's included: pong.js, pong.css, pong.alt*.css (get the files here or email me: http://linuxrules94.users.sf.net/wordpress/2013/09/15/adding-yet-another-pong-to-your-site/)

Add the following to head and replace path/to/pong.css with the path of one of 3 css files included:

<link href="path/to/pong.css" rel="stylesheet" type="text/css">
<script src="http://code.jquery.com/jquery-1.10.1.min.js"></script>
<script src="http://code.jquery.com/jquery-migrate-1.2.1.min.js"></script>
<script src="path/to/pong.js"></script>
<script>$(function(){InitPong()});</script>


and if wanted you can add elements to start & stop pong:

  <button id="pong_pause_toggle"></button>
  <button id="pong_interactive_toggle"></button>
  
Notes to self:
  This code is not finished reaching 2.0
  need to put code in git/bzr branch
  need to allow user to change ball & paddle sizes 
    (level will adjust it now, but  we might want a initial size, or have a option to adjust individual things)

  need to fix speedup function / level
  need to fix animation and fps option (done,  no need for FPS)
  need to fix AI for single_player_two_paddles when interactive == false, so it is single player AI
  need to clean code
  need to adapt for phones

  (I could fix ball_vx & ball_vy by prefixing with init so levels wont mess it up)
*/
/// settings
var level = 5;
var ball_vy = 5; // velocity (also set by level) (default =  5)
var ball_vx = 5; // ditto
var P1VY = 10; // velocity for keyboard (default =  10)
var P2VY = 10; // ditto
var AI_difficulty = 0.5; // 0 - 1 (float values) (default =  0)
var AI_player = 2; // 0 =  off  --- 1 =  P1 is cpu  /  2 =  P2 is cpu (default =  2)
//var use_mouse_as_ctrl = true;          // default =  true
var inputMethod = 'mousemove';
var single_player_two_paddles = false; // default =  false 
var level_up_auto = true; // default =  false
var interactive = false; // default =  false
var menu = false; // default =  false
var paused = false; // default =  false

var level_changes_paddle_size = true;

/// No user serviceable parts below!
var $p1;
var $p2;
var $p1_score;
var $p2_score;
var $ball;
var window_height;
var window_width;
var inputMethods = [];

var P1InitSize = 100;
var P2InitSize = 100;
var FrameID;
var blinker;
var p1_hit = false; // Nasty kludge to workaround 
var p2_hit = false; //  bug with paddle collision check (need proper fix!)
var AI_error = 0;
var AI_random = 0;
var link_velocity_of_players = true;
var FixBoundary = false;



function Pong(){
 this.level = function (arg){
    if ($.isNumeric(arg)){
      level = arg;
    }
    return level;
  }
  /*
  this.ball_vy = function (arg){
   if ($.isNumeric(arg)){
     ball_vy = this.ball_vy;
   }
   return ball_vy;
 }
  this.ball_vx = function (arg){
   if ($.isNumeric(arg)){
     ball_vx = this.ball_vx;
   }
   return ball_vx;
 }
 */
  this.Player1Velocity = function (arg){
   if ($.isNumeric(arg)){
     P1VY = arg;
   }
   return P1VY;
 }
  this.Player2Velocity = function (arg){
   if ($.isNumeric(arg)){
     P2VY = arg;
   }
   return P2VY;
 }
  this.AI_difficulty = function (arg){
   if ($.isNumeric(arg) && (arg => 0 && arg <= 1)){
     AI_difficulty = arg;
   }
   return AI_difficulty;
 }

  this.AI_player = function (arg){
   if ($.isNumeric(arg) && (arg => 0 && arg <= 2)){
     AI_player = arg;
   }
   return AI_player;
 }
 /*
  this.InputMethod = function (arg){ // need in array check
   if (){
     inputMethod = arg;
   }
   return inputMethod;
 }
*/
 
  this.DualPaddles = function (arg){
   if (arguments.length > 0){
     single_player_two_paddles = arg;
   }
   return single_player_two_paddles;
 }
 
  this.AutoLevelUp = function (arg){
   if (arguments.length > 0){
     level_up_auto = arg;
   }
   return level_up_auto;
 }

   this.Interactive = function (arg){
   if (arguments.length > 0){
     interactive = arg;
   }
   return interactive;
 }
 this.Menu = function (arg){
   if (arguments.length > 0){
     menu = arg;
   }
   return menu;
 }
  this.Paused = function (arg){
   if (arguments.length > 0){
     paused = arg;
   }
   return paused;
 }
 this.LevelChangesPaddleSize = function (arg){
   if (arguments.length > 0){
      level_changes_paddle_size = arg;
   }
   return  level_changes_paddle_size;
 }
  _InitPong();
}
if (!jQuery) {
    // load jquery if user forgot to load it
    console.log("Pong: You fogot to load JQuery, falling back to JQuery 1.10.1!");
    document.write('<script src="http://code.jquery.com/jquery-1.10.1.min.js"></script>');
    document.write('<script src="http://code.jquery.com/jquery-migrate-1.2.1.min.js"></script>');
}

// homemade jquery plugin to catch double keypress
(function ($) {
    $.fn.doublekeypress = function (funcCall, deltaTime) {
        var lastKeyCode = 0;
        var lastKeyTime = 0;
        if ($.isNumeric(deltaTime) == false) {
            deltaTime = 600;
        }
        return this.each(function () {
            $(this).keypress(function (event) {
                var newKeyCode = event.which;
                if (newKeyCode == lastKeyCode) {
                    var newKeyTime = (new Date()).getMilliseconds();
                    if (newKeyTime - lastKeyTime <= deltaTime) {
                        lastKeyCode = 0;
                        newKeyTime = 0;
                        return funcCall(event)
                    }
                }
                lastKeyCode = newKeyCode
            })
        })
    }
})(jQuery);
// end

window.requestAnimationFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function ( /* function */ callback, /* DOMElement */ element) {
            window.setTimeout(callback, 1000 / 60);
    };
})();

if (!window.cancelAnimationFrame)
    window.cancelAnimationFrame = function (id) {
        clearTimeout(id);
    };

/**
 * @brief This is for initializing the game, this is executed externally on the users homepage.
 * @notes This is a singleton, it will only run once
 * @return void
 **/
function _InitPong() {
    if (this.ran) return;
    // rather than calling these methods multiple times we set a varible to it's value to instead, to opimize for speed
    // and we reduce it to one call
    $(window).resize(function () {
        window_height = $(window).height();
        window_width = $(window).width();
    }).resize();

    $('body').append('<div id="PongTable"></div>')
    $('#PongTable').append('<div id="P1Score">0</div>');
    $('#PongTable').append('<div id="P2Score">0</div>');
    $('#PongTable').append('<div id="P1" title="I can has turn?"></div>');
    $('#PongTable').append('<div id="P2" title="Muahahaha!"></div>');
    $('#PongTable').append('<div id="Ball" title="Ouch!"></div>');

    $p1_score = $('#PongTable #P1Score');
    $p2_score = $('#PongTable #P2Score');
    $p1 = $('#PongTable #P1');
    $p2 = $('#PongTable #P2');
    $ball = $('#PongTable #Ball');

    P1InitSize = parseInt($p1.css('height'));
    P2InitSize = parseInt($p2.css('height'));

    if ('onkeyup' in document.documentElement) inputMethods.push('keyup');
    if ('onmousemove' in document.documentElement) inputMethods.push('mousemove');
    if ('onorientationchange' in document.documentElement) inputMethods.push('orientationchange');
    if ('ontouchstart' in document.documentElement) inputMethods.push('touchstart');

    $("#PongTable").dblclick(function () {
        if (interactive) $('#pong_interactive_toggle').click();
    });

    $('#pong_btn_group').css('display', 'inline');
    $('#pong_pause_toggle').css('display', 'inline').click(function () {
        paused = !paused;
        PostInit()
    });

    $('#pong_interactive_toggle').css('display', 'inline').click(function () {
        if (interactive) {
            interactive = false;
            return PostInit()
        }
        setTimeout(toggleMenu, 500)
    });

    this.blur = function () {
        if (menu) return;
        paused = true;
        PostInit()
        $(window).unbind('blur', this.blur);
    };
    this.focus = function () {
        if (menu) return;
        paused = false;
        PostInit()
        $(window).bind('blur', this.blur);
    };
    $(window).bind('focus', this.focus);


    if (!FixBoundary) {
        for (i = 0; i <= (window_height / 2); i++) {
            $ball.css('top', i + 'px');
            if (FixBoundary =
                ((window_height - parseInt($ball.css('top'))) - parseInt($ball.css('height')) != parseInt($ball.css('bottom')))) break;
        }
    }
    $ball.css('left', window_width / 2 + 'px');
    $ball.css('top', window_height / 2 + 'px');

    /// menu start
    $('#PongTable').append('<div id="menu">\
        <span id="blink">Double press the p key to close.</span><br>\
        <table>\
            <tr>\
                <td>P1</td>\
                <td></td>\
                <td>P2</td>\
            </tr>\
            <tr>\
                <td><input id="P1VY" max="100" min="1" type="number"></td>\
                <td><input id="link_velocity_of_players" type="checkbox"></td>\
                <td><input id="P2VY" max="100" min="1" type="number"></td>\
                <td>velocity</td>\
            </tr>\
        </table>\
        <hr>\
        <table>\
            <tr>\
                <td>\
                <select id="AI_player">\
                    <option value="0">CPU: Off</option>\
                    <option value="2">CPU: P2</option>\
                    <option value="1">CPU: P1</option>\
                </select>\
                </td>\
                <td><input id="AI_difficulty" max="100" min="0" type="number"></td>\
                <td>% difficulty</td>\
                <td></td>\
            </tr>\
            <tr>\
                <td>Level </td>\
                <td><input id="level" max="100" min="1" type="number"></td>\
                <td></td>\
            </tr>\
        </table>\
        <hr>\
        <input id="single_player_two_paddles" type="checkbox">Single player with no CPU<br>\
        <!--<input id="use_mouse_as_ctrl"    type="checkbox">Use mouse as control<br>-->\
        InputMethod: <select id="inputMethod">\
        <!--<option value="0">Keyboard</option>\
        <option value="2">Mouse</option>\
        <option value="1">Touch drag</option>\
        <option value="1">Touch click</option>\
        <option value="1">Gyroscope</option>-->\
        </select><br>\
        <input id="level_up_auto"        type="checkbox">Automatically level up<br>\
        <input id="interactive"          type="checkbox">interactive<br>\
        <input id="paused"               type="checkbox">paused<br>\
        <span style="display: inline">\
              <a id="ResetScores"   href="#">Reset scores</a>&nbsp;\
              <a id="ResetSettings" href="#">Default settings</a>\
        </span><br>\
        +/-: Level | A/Z: P1 | J/M: P2 | <a href="javascript:void(0)" onclick="About()">Info</a><br>\
</div>');

    $.each(inputMethods, function (index, value) {
        $('#inputMethod').append($('<option/>', {
            value: value,
            text: value
        }))
    });
    $('#PongTable #AI_player').change(function () {
        eval(this.id + '= parseInt(this.value)');
    });
    $('#PongTable #inputMethod').change(function () {
        eval(this.id + '= this.value');
    });
    $('#PongTable').find('#level,#P1VY,#P2VY').change(function () {
        eval('this.value = ' + this.id + '= ($.isNumeric(this.value)) ? this.value : ' + this.id);
        if (link_velocity_of_players) {
            if (this.id == 'P1VY') $('#PongTable #P2VY').val(P2VY = P1VY);
            if (this.id == 'P2VY') $('#PongTable #P1VY').val(P1VY = P2VY);
            if (this.id == 'level') speedup(2);
        }
    }).keyup(function () {
        $(this).change()
    });
    $('#PongTable input[type="checkbox"]').click(function () {
        eval(this.id + '= this.checked')
        if (this.id == 'paused' && this.checked) menu = false, PostInit()
        if (this.id == 'single_player_two_paddles') $('#PongTable #AI_player').attr('disabled', this.checked);
    });
    $('#PongTable #AI_difficulty').change(function () {
        if (parseInt(this.value) < 0 || parseInt(this.value) > 100) return this.value = AI_difficulty * 100;
        AI_difficulty = (this.value = parseInt(this.value)) / 100
    }).keyup(function () {
        $(this).change()
    });

    $('#PongTable #ResetScores').click(function (e) {
        e.preventDefault();
        $p1_score.text(0);
        $p2_score.text(0);
    });
    $('#PongTable #ResetSettings').click(function (e) {
        e.preventDefault();
        localStorage.clear();
        location.reload();
    });

    $('#PongTable #menu').css({
        'margin-left': -$('#PongTable #menu').outerWidth() / 2 + 'px',
        'margin-top': -$('#PongTable #menu').outerHeight() / 2 + 'px'
    });
    $('body').click(function () {
        if (menu) toggleMenu()
    });
    $('#PongTable #menu').click(function (e) {
        e.stopPropagation()
    });
    $('#PongTable #menu').fadeOut(0);
    /// menu end

    if (typeof (Storage) !== 'undefined') {
        //if ($.isNumeric(localStorage.fps)) fps = parseInt(localStorage.fps);
        if ($.isNumeric(localStorage.AI_difficulty)) AI_difficulty = parseInt(localStorage.AI_difficulty);
        if ($.isNumeric(localStorage.AI_player)) AI_player = parseInt(localStorage.AI_player);
        if ($.isNumeric(localStorage.P1VY)) P1VY = parseInt(localStorage.P1VY);
        if ($.isNumeric(localStorage.P2VY)) P2VY = parseInt(localStorage.P2VY);
        if (localStorage.single_player_two_paddles !== undefined) single_player_two_paddles = parseBool(localStorage.single_player_two_paddles);
        if (localStorage.level_up_auto !== undefined) level_up_auto = parseBool(localStorage.level_up_auto);
        //if (localStorage.inputMethod               !== undefined) inputMethod               = parseBool(localStorage.inputMethod);
        if (localStorage.paused !== undefined) paused = parseBool(localStorage.paused);
        if (localStorage.menu !== undefined) menu = parseBool(localStorage.menu);
        if (localStorage.interactive !== undefined) interactive = parseBool(localStorage.interactive);
        if (localStorage.link_velocity_of_players !== undefined) link_velocity_of_players = parseBool(localStorage.link_velocity_of_players);
        if (localStorage.FixBoundary !== undefined) FixBoundary = parseBool(localStorage.FixBoundary);
    }

    $(document).doublekeypress(function (e) {
        if (e.which == 112) toggleMenu()
    }); // p key = pause
    PostInit();
    this.ran = true;
}
/**
 * @brief This sets the params and saves them
 * @notes
 * @return void
 **/
function PostInit() {
    _menu();

    $('#pong_pause_toggle').text((paused ? 'play' : 'pause') + ' pong');
    $('#pong_interactive_toggle').text((interactive ? 'quit' : 'start') + ' pong');


    $('#PongTable').removeClass('interactive');

    //for (var input in inputMethods) {
    //    $(document).off(input); //, EventHandler);
    //}
    $(document).off();

    if (jQuery.inArray(inputMethod, inputMethods) == -1) {
        console.log("inputMethod: ", inputMethod, ": not found using: ", inputMethods[0], " input instead");
        inputMethod = inputMethods[0];
    }

    if ((single_player_two_paddles || AI_player) && interactive) {
        console.log("inputMethod: ", inputMethod);
        $(document).on(inputMethod, EventHandler);
    }

    if (interactive) $('#PongTable').addClass('interactive');

    if (single_player_two_paddles) AI_player = 0;
    if (inputMethod != 'keyup' && !single_player_two_paddles && !AI_player) AI_player = 2;

    if (!paused) {
        if (!FrameID) FrameID = window.requestAnimationFrame(play);
    } else {
        window.cancelAnimationFrame(FrameID);
        FrameID = 0;
    }

    if (typeof (Storage) !== 'undefined') {
        localStorage.AI_difficulty = AI_difficulty;
        localStorage.AI_player = AI_player;
        localStorage.single_player_two_paddles = single_player_two_paddles;
        localStorage.level_up_auto = level_up_auto;
        localStorage.inputMethod = inputMethod;
        localStorage.paused = paused;
        localStorage.menu = menu;
        localStorage.interactive = interactive;
        localStorage.link_velocity_of_players = link_velocity_of_players;
        localStorage.P1VY = P1VY;
        localStorage.P2VY = P2VY;
        localStorage.FixBoundary = FixBoundary;
    }
}
/**
 * @brief This is for changing the speed and level
 * @notes
 * @return void
 **/
function speedup(mode) {

    switch (mode) {
    case 0:
        level++;
        break;
    case 1:
        level--;
        break;
    }

    level = constrain(level, 0, 100);

    if (Math.abs(ball_vx) < 100) {
        ball_vy = (ball_vy < 0 ? -1 : 1) * level;
        ball_vx = (ball_vx < 0 ? -1 : 1) * level;
    }

    if (level_changes_paddle_size) {
        if (parseInt($p1.css('height')) > 15) $p1.css('height', Math.ceil(P1InitSize - ((level * 2.5) / 100) * P1InitSize) + 'px');
        if (parseInt($p2.css('height')) > 15) $p2.css('height', Math.ceil(P2InitSize - ((level * 2.5) / 100) * P2InitSize) + 'px');
    }

    if (interactive) document.title = 'Level: ' + level;
}

/**
 * @brief This is for toggling the config menu
 * @notes
 * @return true if paused
 **/
function toggleMenu() {
    // if menu is false then menu and pause are set true, and vice versa
    paused = menu = !menu;
    if (menu) interactive = true;
    PostInit();
    return paused
}
/**
 * @brief This is for setting and getting menu data
 * @notes
 * @return void (ambiguous)
 **/
function _menu() {
    if (menu) {
        if (!blinker) blinker = setInterval(function () {
            $('#PongTable #blink').fadeToggle(1000)
        }, 1000);
    } else {
        clearInterval(blinker);
        blinker = 0;
        return $('#PongTable #menu').fadeOut(1000);
    }

    $('#PongTable #level').val(level);
    $('#PongTable #P1VY').val(P1VY);
    $('#PongTable #P2VY').val(P2VY);
    $('#PongTable #single_player_two_paddles').attr('checked', single_player_two_paddles);
    //$('#PongTable #use_mouse_as_ctrl').attr('checked', use_mouse_as_ctrl);
    $('#PongTable #level_up_auto').attr('checked', level_up_auto);
    $('#PongTable #interactive').attr('checked', interactive);
    $('#PongTable #paused').attr('checked', false);
    $('#PongTable #AI_player').val(AI_player);
    $('#inputMethod').val(inputMethod);
    $('#PongTable #AI_player').attr('disabled', single_player_two_paddles);
    $('#PongTable #AI_difficulty').val(AI_difficulty * 100);
    $('#PongTable #link_velocity_of_players').attr('checked', link_velocity_of_players);

    $('#PongTable #menu').fadeIn(1000);
}
/**
 * @brief This is our animation loop
 * @notes
 * @return void
 **/
function play() {
    //var start = Date.now();
    if (!paused) window.requestAnimationFrame(play);
    if (FixBoundary) {
        //console.log("FixBoundary");
        $p1.css('bottom', (window_height - parseInt($p1.css('top'))) - parseInt($p1.css('height')) + 'px');
        $p2.css('bottom', (window_height - parseInt($p2.css('top'))) - parseInt($p2.css('height')) + 'px');
        //$p2.css('right',(window_width - parseInt($p2.css('left'))) - parseInt($p2.css('width')) + 'px');
        $ball.css('bottom', (window_height - parseInt($ball.css('top'))) - parseInt($ball.css('height')) + 'px');
        $ball.css('right', (window_width - parseInt($ball.css('left'))) - parseInt($ball.css('width')) + 'px');
    }
    // rather than calling these methods multiple times we set a varible to it's value to instead,and we reduce it to one call to optimize for speed
    ball_top = parseInt($ball.css('top'));
    ball_bottom = parseInt($ball.css('bottom'));
    ball_left = parseInt($ball.css('left'));
    ball_right = parseInt($ball.css('right'));
    ball_width = parseInt($ball.css('width'));
    ball_height = parseInt($ball.css('height'));

    p1_top = parseInt($p1.css('top'));
    p1_bottom = parseInt($p1.css('bottom'));
    p1_left = parseInt($p1.css('left'));
    p1_width = parseInt($p1.css('width'));
    p1_height = parseInt($p1.css('height'));

    p2_top = parseInt($p2.css('top'));
    p2_bottom = parseInt($p2.css('bottom'));
    p2_right = parseInt($p2.css('right'));
    p2_width = parseInt($p2.css('width'));
    p2_height = parseInt($p2.css('height'));

    if ((AI_player && !single_player_two_paddles) || !interactive) {
        if (!interactive) AI_player = (ball_vx < 0) ? 1 : 2;
        if ((AI_player == 1 && ball_vx < 0) || (AI_player == 2 && ball_vx > 0)) {
            var tmp_id = (AI_player == 1) ? $p1 : $p2;
            var ball_pos = ball_top - (parseInt($(tmp_id).css('height')) / 2) + AI_error * (ball_vy < 0 ? -1 : 1);
            var AI_vy = (inputMethod == 'keyup') ? (AI_player == 1 ? P1VY : P2VY) : 1;
            if (ball_vy < 0) {
                for (i = parseInt($(tmp_id).css('top')); i >= ball_pos; i -= AI_vy) {
                    $(tmp_id).css('top', i + 'px');
                }
            } else {
                for (i = parseInt($(tmp_id).css('top')); i <= ball_pos; i += AI_vy) {
                    $(tmp_id).css('top', i + 'px');
                }
            }
            if (parseInt($(tmp_id).css('top')) + parseInt($(tmp_id).css('height')) > window_height) $(tmp_id).css('top', (window_height - parseInt($(tmp_id).css('height'))) + 'px');
            if (parseInt($(tmp_id).css('top')) < 0) $(tmp_id).css('top', '0px');
        }
    }
    if (ball_top <= Math.abs(ball_vy) || ball_bottom <= Math.abs(ball_vy)) {
        ball_vy *= -1;
    }
    if (!p2_hit && ball_top + Math.abs(ball_vy) >= p2_top && ball_bottom + Math.abs(ball_vy) >= p2_bottom && ball_right - Math.abs(ball_vx) <= p2_right + p2_width) {
        if (!single_player_two_paddles) {
            $p2_score.text(parseInt($p2_score.text()) + 1);
            //console.log("score P2 +1");
        } else {
            $p1_score.text(parseInt($p1_score.text()) + 1);
        }
        ball_vx *= -1;
        if (AI_player == 2 || !interactive) {
            SetAI_error(p1_height);
        }
        p1_hit = false;
        p2_hit = true;
        if (level_up_auto && !(parseInt($p1_score.text()) ^ 5)) speedup(0);
    } else {
        if (ball_right <= Math.abs(ball_vx)) {
            if (AI_player == 2 || !interactive) {
                SetAI_error(p2_height);
            }
            if (!single_player_two_paddles) {
                $p1_score.text(parseInt($p1_score.text()) + 1);
            } else {
                $p2_score.text(parseInt($p2_score.text()) + 1);
            }
            // need to add serve code here
            ball_left = window_width / 2;
            ball_top = window_height / 2;
            p1_hit = false;
            p2_hit = false;
            if (level_up_auto) {
                level = 0;
                speedup(0);
            }
        }
    }
    if (!p1_hit && ball_top + Math.abs(ball_vy) >= p1_top && ball_bottom + Math.abs(ball_vy) >= p1_bottom && ball_left - Math.abs(ball_vx) <= p1_left + p1_width) {
        $p1_score.text(parseInt($p1_score.text()) + 1);
        ball_vx *= -1;
        if (AI_player == 1 || !interactive) {
            SetAI_error(p2_height);
        }
        p1_hit = true;
        p2_hit = false;
        if (level_up_auto && !(parseInt($p1_score.text()) ^ 5)) speedup(0);
    } else {
        if (ball_left <= Math.abs(ball_vx)) {
            if (AI_player == 1 || !interactive) {
                SetAI_error(p1_height);
            }
            $p2_score.text(parseInt($p2_score.text()) + 1);
            ball_left = window_width / 2;
            ball_top = window_height / 2;
            if (level_up_auto) {
                level = 0;
                speedup(0);
            }
            p1_hit = false;
            p2_hit = false;
        }
    }
    ball_left += ball_vx;
    //ball_right   -= ball_vx;
    ball_top += ball_vy;
    //ball_bottom  -= ball_vy;


    //$p2.css('right',(window_width - parseInt($p2.css('left'))) - parseInt($p2.css('width')) + 'px');
    $ball.css('bottom', (window_height - parseInt($ball.css('top'))) - parseInt($ball.css('height')) + 'px');
    $ball.css('right', (window_width - parseInt($ball.css('left'))) - parseInt($ball.css('width')) + 'px');
    // reduced to one call for speed
    $ball.css({
        'top': ball_top + 'px',
        //'bottom':  ball_bottom + 'px',
        'left': ball_left + 'px',
        //'right' :  ball_right  + 'px'
    });
    //console.log(Date.now() - start);
}

/**
 * @brief This is our dice roll for error margin
 * @notes
 * @return void
 **/
function SetAI_error(player_id) {
    AI_error = Math.random() * (2 * player_id * (1 - AI_difficulty)) * (Math.random() > 0.5 ? 1 : -1);
    //ball_vx  += Math.random() *  (Math.random() > 0.5 ? 1 : -1);
    //ball_vy  += Math.random() *  (Math.random() > 0.5 ? 1 : -1);
}
/**
 * @brief This is for linking * events to paddles
 * @notes very buggy at the moment
 * @return true
 **/
function EventHandler(event) {
    if (!interactive) return;
    switch (event.type) {
    case 'keyup':
        //console.log("caught: ",event.type);
        return KeyboardHandler(event);
    case 'mousemove':
        //console.log("caught: ",event.type);
        return MouseHandler(event);
        // for touch there is two modes: dragging, or tapping
    case 'touchstart':
    case 'touchmove':
    case 'touchend':
        //console.log("caught: ",event.type);
        return TouchHandler(event);
    case 'orientationchange':
        //console.log("caught: ",event.type);
        return OrientationChangeHandler(event);
    }
}

/**
 * @brief This is for linking gyro to paddles
 * @notes
 * @return true
 **/

function OrientationChangeHandler(event) {
    var $real_player = null;
    if (single_player_two_paddles) {
        $real_player = $p1.add($p2);
    } else {
        $real_player = (AI_player == 1) ? $p2 : $p1;
    }

    var beta = constrain(event.beta, -45, 45);
    beta = Math.round(map(beta, -45, 45, 0, (window_height - parseInt($real_player.css('height')))));

    $real_player.css('top', beta + 'px');
    return true;
}

/**
 * @brief This is for linking touch events to paddles
 * @notes
 * @return true
 **/
function TouchHandler(event) {
  // half of screen allocated to P1, other half P2
  var $real_player = null;
  if  (single_player_two_paddles){
      $real_player = $p1.add($p2);
  } else {
      $real_player = (event.changedTouches[0].pageX < window_width / 2) ? $p1 : $p2;
  }
  var y = Math.round((event.changedTouches[0].pageY - $(document).scrollTop()) - (parseInt($real_player.css('height')) / 2))
  $real_player.css('top', y + 'px');
  return true;
}

/**-
 * @brief This is for linking mouse to paddles
 * @notes
 * @return true
 **/
function MouseHandler(event) {
    var $real_player = null;
    if (single_player_two_paddles) {
        $real_player = $p1.add($p2);
    } else {
        $real_player = (AI_player == 1) ? $p2 : $p1;
    }
    var y = Math.round((event.pageY - $(document).scrollTop()) - (parseInt($real_player.css('height')) / 2));
    $real_player.css('top', constrain(y, 0, window_height - parseInt($real_player.css('height'))) + 'px');
    return true;
}
/**
 * @brief This is for linking keyboard to paddles
 * @notes
 * @return true
 **/
function KeyboardHandler(e) {
    //document.title=e.which;
    //document.title=String.fromCharCode(e.which);
    p1_top = parseInt($p1.css('top'));
    p1_bottom = parseInt($p1.css('bottom'));
    p1_left = parseInt($p1.css('left'));
    p1_width = parseInt($p1.css('width'));
    p1_height = parseInt($p1.css('height'));

    p2_top = parseInt($p2.css('top'));
    p2_bottom = parseInt($p2.css('bottom'));
    p2_right = parseInt($p2.css('right'));
    p2_width = parseInt($p2.css('width'));
    p2_height = parseInt($p2.css('height'));
    switch (e.which) {
    case 65:
        // a
        if (AI_player == 1) return;
        if (p1_top > 0) {
            p1_top -= P1VY;
            p1_bottom += P1VY;
        }
        break;
    case 90:
        // z
        if (AI_player == 1) return;
        //console.log(p1_bottom, P1VY, p1_bottom > P1VY);
        if (p1_bottom > 0) {
            p1_top += P1VY
            p1_bottom -= P1VY;
        }
        break;
    case 74:
        // j
        if (AI_player == 2) return;
        if (p2_top > 0) {
            p2_top -= P2VY;
            p2_bottom += P2VY;
        }
        break;
    case 77:
        // m
        if (AI_player == 2) return;
        if (p2_bottom > 0) {
            p2_top += P2VY
            p2_bottom -= P2VY;
        }
        break;
    case 187:
        // +
        speedup(0);
        break;
    case 189:
        // -
        speedup(1);
        break;
    }

    if (single_player_two_paddles) {
        p1_top = p2_top;
        p1_bottom = p2_bottom;
    }
 
    $p1.css({
        'top': p1_top + 'px',
        'bottom': p1_bottom + 'px',
        'left': p1_left + 'px'
    });

    $p2.css({
        'top': p2_top + 'px',
        'bottom': p2_bottom + 'px',
        'right': p2_right + 'px'
    });

    return true;
}

/**
 * @brief This is a bugfix
 * @notes
 * @return void
 **/
function parseBool(value) {
    if (value == null || value == "") return false;
    return (value.toLowerCase() == 'true' || value == '1');
}

/**
 * @brief constrains values to lbound..ubound
 * @notes
 * @return result
 **/
function constrain(value, lbound, ubound) {
  if(value < lbound) {
    return lbound;
  }
  else if(value > ubound) {
    return ubound;
  }
  return value;
}

/**
 * @brief maps values to in_min..in_maz to out_min..out_max
 * @notes
 * @return result
 **/
function map(value, in_min, in_max, out_min, out_max)
{
  return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}


function About() {
    // DON'T TOUCH THIS OR ELSE! Unless you are contributing and keep my copyright intact :-)
    window.open('http://linuxrules94.users.sourceforge.net/wordpress/2013/09/15/adding-yet-another-pong-to-your-site/', '_blank');
    //window.focus();
    alert("Copyright (C) 2012-2013 Mitchell Lafferty <http://linuxrules94.users.sf.net/> <coolspeedy6 at gmail dot com>\n\
       Released under the GNU GPL.\n\
       Please read the source code for more info. (pong.js)");
}