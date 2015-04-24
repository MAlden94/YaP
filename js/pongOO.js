/*
 * C *opyright (C) 2012-2013 Mitchell Lafferty <coolspeedy6 at gmail dot com>
 * Released under the GNU GPL.
 *
 * YaP (Yet another Pong) is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * YaP is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with YaP. If not, see <http://www.gnu.org/licenses/>.
 *
 * If you or someone else happens to edit/fork this code
 * I would love to see the improvement you/they made
 * to the code, so please email me if you wish to.
 *
 * For any questions please email me.
 *
 * What's included: pong.js, pong.css, pong.alt*.css (get the files here or email me: http://linuxrules94.users.sf.net/wordpress/2013/09/15/adding-yet-another-pong-to-your-site/)
 *
 * Add the following to head and replace path/to/pong.css with the path of one of 3 css files included:
 *
 * <link href="path/to/pong.css" rel="stylesheet" type="text/css">
 * <script src="http://code.jquery.com/jquery-1.10.1.min.js"></script>
 * <script src="http://code.jquery.com/jquery-migrate-1.2.1.min.js"></script>
 * <script src="path/to/pong.js"></script>
 * <script>$(function(){InitPong()});</script>
 *
 *
 * and if wanted you can add elements to start & stop pong:
 *
 * <button id="pong_pause_toggle"></button>
 * <button id="pong_interactive_toggle"></button>
 *
 * Notes to self:
 * This code is not finished reaching 2.0
 * need to put code in git/bzr branch
 * need to allow user to change ball & paddle sizes
 * (Level will adjust it now, but  we might want a initial size, or have a option to adjust individual things)
 *
 * need to fix speedup function / Level (done)
 * need to fix animation and fps option (done,  no need for FPS)
 * need to fix AI for DualPaddles when Interactive == false, so it is single player AI
 * need to clean code
 * need to adapt for phones
 * need to put settings in a array, so it is easy to set/ get the menu and save/load settings
 *
 * (I could fix ball_vx & ball_vy by prefixing with init so Levels wont mess it up)
 */
/// settings


/// No user serviceable parts below!
var $p1;
var $p2;
var $p1_score;
var $p2_score;
var $ball;
var window_height;
var window_width;
var OldInputMethod;
var InputMethods = [];


var P1InitSize = 100;
var P2InitSize = 100;

var FrameID;
var blinker;
var p1_hit = false; // Nasty kludge to workaround
var p2_hit = false; //  bug with paddle collision check (need proper fix!)
var AI_error  = 0;
//var AI_random = 0;
var link_velocity_of_players = true;
var FixBoundary = false;

if (!jQuery)
  {
    // load jquery if user forgot to load it
    console.log("Pong: You fogot to load JQuery, falling back to JQuery 1.10.1!");
    document.write('<script src="http://code.jquery.com/jquery-1.10.1.min.js"></script>');
    document.write('<script src="http://code.jquery.com/jquery-migrate-1.2.1.min.js"></script>');
  }

// homemade jquery plugin to catch double keypress
(function ($)
{
  $.fn.doublekeypress = function (funcCall, deltaTime)
  {
    var lastKeyCode = 0;
    var lastKeyTime = 0;
    if ($.isNumeric(deltaTime) == false)
      {
        deltaTime = 600;
      }
    return this.each(function ()
    {
      $(this).keypress(function (event)
      {
        var newKeyCode = event.which;
        if (newKeyCode == lastKeyCode)
          {
            var newKeyTime = (new Date()).getMilliseconds();
            if (newKeyTime - lastKeyTime <= deltaTime)
              {
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

window.requestAnimationFrame = (function ()
{
  return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function ( /* function */ callback, /* DOMElement */ element)
  {
    window.setTimeout(callback, 1000 / 60);
  };
})();

if (!window.cancelAnimationFrame)
  window.cancelAnimationFrame = function (id)
  {
    clearTimeout(id);
  };

/**
 * @brief This is for initializing the game, this is executed externally on the users homepage.
 * @notes This is a singleton, it will only run once (Pong = null when this function reaches the end)
 * @return void
 **/
function Pong()
{

  Pong = function ()
  {
    console.log("Pong already initalized!")
  }

  this.InputMethodNames =
  {
'mousemove': 'Mouse'
    ,
'keyup': 'Keyboard'
    ,
'touchstart': 'Touch'
    ,
'deviceorientation': 'Gyroscope'
    ,
  };

  this.ball_vy = 5; // velocity (also set by Level) (default =  5)
  this.ball_vx = 5; // ditto
  this.Player1Velocity = 10; // velocity for keyboard (default =  10)
  this.Player2Velocity = 10; // ditto
  this.AI_difficulty = 50; // 0 - 100 (default =  50)
  this.AI_player = 2; // 0 =  off  --- 1 =  P1 is cpu  /  2 =  P2 is cpu (default =  2)
  this.degreeOfMotion = 45;
  InputMethod = 'deviceorientation';
  this.DualPaddles = false; // default =  false
  this.AutoLevelUp = true; // default =  false
  this.Interactive = false; // default =  false
  this.Menu = false; // default =  false
  this.Paused = false; // default =  false

  this.LevelChangesPaddleSize = true;

  // rather than calling these methods multiple times we set a varible to it's value to instead, to opimize for speed
  // and we reduce it to one call
  $(window).resize(function ()
  {
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

  $.each(this.InputMethodNames, function (index, value)
  {
    if ('on' + index in window) InputMethods.push(index); // broken
  });

  $("#PongTable").dblclick(function ()
  {
    if (this.Interactive) $('#pong_interactive_toggle').click();
  });

  $('#pong_btn_group').css('display', 'inline');
  $('#pong_pause_toggle').css('display', 'inline').click(function ()
  {
    this.Paused = !this.Paused;
    PostInit()
  });

  $('#pong_interactive_toggle').css('display', 'inline').click(function ()
  {
    if (this.Interactive)
      {
        this.Interactive = false;
        return PostInit()
      }
           setTimeout(toggleMenu, 500)
  });

  var blur = function ()
  {
    if (this.Menu) return;
    this.Paused = true;
    PostInit()
    $(window).off('blur', blur);
  };
  var focus = function ()
  {
    if (this.Menu) return;
    this.Paused = false;
    PostInit()
    $(window).on('blur', blur);
  };
  $(window).on('focus', focus);


  if (!this.FixBoundary)
    {
      for (i = 0; i <= (window_height / 2); i++)
        {
          $ball.css('top', i + 'px');
          if (this.FixBoundary =
                ((window_height - parseInt($ball.css('top'))) - parseInt($ball.css('height')) != parseInt($ball.css('bottom')))) break;
        }
    }
  $ball.css('left', window_width / 2 + 'px');
  $ball.css('top', window_height / 2 + 'px');

  /// Menu start
  $('#PongTable').append('<div id="Menu">\
    <span id="blink">Double press the p key to close.</span><br>\
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
    <td><input id="Level" max="100" min="1" type="number"></td>\
    <td></td>\
    </tr>\
    <tr>\
    <td>Input method</td>\
    <td></td>\
    <td id="degreeOfMotionlabel" style="display: none">&deg; Of Motion</td>\
    </tr>\
    <tr>\
    <td><select id="InputMethod"></select></td>\
    <td></td>\
    <td><input id="degreeOfMotion" max="360" min="0" type="number" style="display: none"></td>\
    </td>\
    </table>\
    <table class="PlayerVelocity" style="display: none">\
    <tr>\
    <td>P1</td>\
    <td></td>\
    <td>P2</td>\
    </tr>\
    <tr>\
    <td><input id="Player1Velocity" max="100" min="1" type="number"></td>\
    <td><input id="link_velocity_of_players" type="checkbox"></td>\
    <td><input id="Player2Velocity" max="100" min="1" type="number"></td>\
    <td>velocity</td>\
    </tr>\
    </table>\
    <hr>\
    <input id="DualPaddles" type="checkbox">Dual Paddles<br>\
    <!--<input id="use_mouse_as_ctrl"    type="checkbox">Use mouse as control<br>-->\
    <input id="AutoLevelUp"         type="checkbox">Automatically Level up<br>\
    <input id="Interactive"         type="checkbox">Interactive<br>\
    <input id="Paused"              type="checkbox">Paused<br>\
    <span style="display: inline">\
    <a id="ResetScores"   href="#">Reset scores</a>&nbsp;\
    <a id="ResetSettings" href="#">Default settings</a>\
    </span><br>\
    +/-: Level | A/Z: P1 | J/M: P2 | <a id="Info" href="#">Info</a><br>\
    </div><div id="About">Copyright (C) 2012-2013 Mitchell Lafferty &lt;<a href="http://linuxrules94.users.sf.net/">http://linuxrules94.users.sf.net/</a>&gt; <coolspeedy6 at gmail dot com><br>\
    Released under the GNU GPL.<br>\
    Please read the source code for more info. (pong.js)<br>\
    <a href="bitcoin:1PY75zmR9y7KgaVf6DPstHSc9zFHnovJ9a?label=Donations%20Address%20for%20linuxrules94"><em>Bitcoin donations :)</em></a></div>');

  $.each(InputMethods, function (index, value)
  {
    $('#InputMethod').append($('<option/>',
    {
value: value,
text: value
    }))
  });

  $('#PongTable').find('#AI_player, #degreeOfMotion, #AI_difficulty').change(function ()
  {
    eval('this.' + this.id + '= parseInt(this.value)');
  }).keyup(function ()
  {
    $(this).change()
  });

  $('#PongTable #InputMethod').change(function ()
  {
    $('#PongTable').find('.PlayerVelocity, #degreeOfMotion, #degreeOfMotionlabel').hide();
    switch (this.value)
      {
      case 'deviceorientation':
        $('#PongTable').find('#degreeOfMotion, #degreeOfMotionlabel').show();
        break;
      case 'keyup':
        $('#PongTable .PlayerVelocity').show();
        break;
      }
    eval('this.' + this.id + '= this.value');
  });

  $('#PongTable').find('#Level, #Player1Velocity, #Player2Velocity').change(function ()
  {
    eval('this.value = this.' + this.id + '= ($.isNumeric(this.value)) ? this.value : this.' + this.id);
    if (this.link_velocity_of_players)
      {
        switch (this.id)
          {
          case 'Player1Velocity':
            if (this.link_velocity_of_players)
              {
                $('#PongTable #Player2Velocity').val(this.Player2Velocity = this.Player1Velocity);
              }
            break;
          case 'Player2Velocity':
            if (this.link_velocity_of_players)
              {
                $('#PongTable #Player1Velocity').val(this.Player1Velocity = this.Player2Velocity);
              }
            break;
          case 'Level':
            speedup(2);
            break;
          }
      }
  }).keyup(function ()
  {
    $(this).change()
  });
  $('#PongTable input[type="checkbox"]').click(function ()
  {
    eval('this.' + this.id + '= this.checked')
    switch (this.id)
      {
      case 'Paused':
        if (this.checked) this.Menu = false, PostInit()
                                        break;
      case 'DualPaddles':
        $('#PongTable #AI_player').attr('disabled', this.checked);
        break;
      }
  });

  $('#PongTable').find('#ResetScores, #ResetSettings, #Info').click(function (e)
  {
    e.preventDefault();
    switch (this.id)
      {
      case 'ResetScores':
        $p1_score.add($p2_score).text(0);
        break;
      case 'ResetSettings':
        localStorage.clear();
        location.reload();
        break;
      case 'Info':
        $('#About').fadeToggle(1000);
        break;
      }
  });

  $('#PongTable').find('#Menu, #About').each(function ()
  {
    $(this).css(
    {
'margin-left': -$(this).outerWidth() / 2 + 'px',
'margin-top': -$(this).outerHeight() / 2 + 'px'
    }).click(function (e)
    {
      e.stopPropagation()
      if (this.id == 'About') $(this).fadeOut(1000);
    }).fadeOut(0);
  });

  $('#Menu').dblclick(function (e)
  {
    e.stopPropagation();
  });

  $('body').click(function ()
  {
    if (this.Menu)
      {
        toggleMenu();
        $('#About').fadeOut(1000);
      }
  });

  /// Menu end

  if (typeof (Storage) !== 'undefined')
    {
      if ($.isNumeric(localStorage.AI_difficulty)) this.AI_difficulty = parseInt(localStorage.AI_difficulty);
      if ($.isNumeric(localStorage.AI_player)) this.AI_player = parseInt(localStorage.AI_player);
      if ($.isNumeric(localStorage.Player1Velocity)) this.Player1Velocity = parseInt(localStorage.Player1Velocity);
      if ($.isNumeric(localStorage.Player2Velocity)) this.Player2Velocity = parseInt(localStorage.Player2Velocity);
      if ($.isNumeric(localStorage.degreeOfMotion)) this.degreeOfMotion = parseInt(localStorage.degreeOfMotion);
      if (localStorage.DualPaddles !== undefined) this.DualPaddles = parseBool(localStorage.DualPaddles);
      if (localStorage.AutoLevelUp !== undefined) this.AutoLevelUp = parseBool(localStorage.AutoLevelUp);
      if (jQuery.inArray(localStorage.InputMethod, InputMethod) != -1) InputMethod = localStorage.InputMethod;
      if (localStorage.Paused !== undefined) this.Paused = parseBool(localStorage.Paused);
      if (localStorage.Menu !== undefined) this.Menu = parseBool(localStorage.Menu);
      if (localStorage.Interactive !== undefined) this.Interactive = parseBool(localStorage.Interactive);
      if (localStorage.link_velocity_of_players !== undefined) this.link_velocity_of_players = parseBool(localStorage.link_velocity_of_players);
      if (localStorage.FixBoundary !== undefined) this.FixBoundary = parseBool(localStorage.FixBoundary);
    }

  $(document).keypress(GlobalKeyboardHandler);

  $(document).doublekeypress(function (e)
  {
    if (e.which == 112) toggleMenu()
    }); // p key = pause

  PostInit();

  /**
   * @brief This sets the params and saves them
   * @notes
   * @return void
   **/
  function PostInit()
  {
    _Menu();

    $('#pong_pause_toggle').text((this.Paused ? 'play' : 'pause') + ' pong');
    $('#pong_interactive_toggle').text((this.Interactive ? 'quit' : 'start') + ' pong');

    if (this.Interactive)
      {
        if ($('#PongTable').hasClass() == false)
          {
            $('#PongTable').addClass('interactive');
          }
      }
    else
      {
        $('#PongTable').removeClass('interactive');
      }

    /*
     * switch (OldInputMethod){
     *  case  'deviceorientation':
     *  case  'touchstart':
     *  case  'touchend':
     *  case  'touchmove':
     *    window.removeEventListener(InputMethod, EventHandler);
     *    break;
     *  default:
     */
    $(window).off(OldInputMethod, EventHandler)
    //}

    if (jQuery.inArray(InputMethod, InputMethods) == -1)
      {
        console.log('InputMethod:', InputMethod, ': not found using: ', InputMethods[0], ' input instead');
        InputMethod = InputMethods[0];
      }

    if ((this.DualPaddles || this.AI_player) && this.Interactive)
      {
        console.log('InputMethod: ', InputMethod);
        OldInputMethod = InputMethod;
        $(window).on(InputMethod, EventHandler)
      }

    if (this.DualPaddles) this.AI_player = 0;
    if (InputMethod != 'keyup' && !this.DualPaddles && !this.AI_player) this.AI_player = 2;

    if (!this.Paused)
      {
        if (!FrameID) FrameID = window.requestAnimationFrame(play);
      }
    else
      {
        window.cancelAnimationFrame(FrameID);
        FrameID = 0;
      }

    if (typeof (Storage) !== 'undefined')
      {
        localStorage.AI_difficulty = this.AI_difficulty;
        localStorage.AI_player = this.AI_player;
        localStorage.DualPaddles = this.DualPaddles;
        localStorage.AutoLevelUp = this.AutoLevelUp;
        localStorage.InputMethod = InputMethod;
        localStorage.degreeOfMotion = this.degreeOfMotion;
        localStorage.Paused = this.Paused;
        localStorage.Menu = this.Menu;
        localStorage.Interactive = this.Interactive;
        localStorage.link_velocity_of_players = this.link_velocity_of_players;
        localStorage.Player1Velocity = this.Player1Velocity;
        localStorage.Player2Velocity = this.Player2Velocity;
        localStorage.FixBoundary = this.FixBoundary;
      }

  }

  /**
   * @brief This is for changing the speed and Level
   * @notes
   * @return void
   **/
  function speedup(mode)
  {

    switch (mode)
      {
      case 0:
        this.Level++;
        break;
      case 1:
        this.Level--;
        break;
      }

    this.Level = constrain(this.Level, 0, 100);

    if (Math.abs(this.ball_vx) < 100)
      {
        this.ball_vy = (this.ball_vy < 0 ? -1 : 1) * this.Level;
        this.ball_vx = (this.ball_vx < 0 ? -1 : 1) * this.Level;
      }

    if (this.LevelChangesPaddleSize)
      {
        if (parseInt($p1.css('height')) > 15) $p1.css('height', Math.ceil(P1InitSize - ((this.Level * 2.5) / 100) * P1InitSize) + 'px');
        if (parseInt($p2.css('height')) > 15) $p2.css('height', Math.ceil(P2InitSize - ((this.Level * 2.5) / 100) * P2InitSize) + 'px');
      }

    if (this.Interactive) document.title = 'Level: ' + this.Level;
  }

  /**
   * @brief This is for toggling the config Menu
   * @notes
   * @return true if Paused
   **/
  function toggleMenu()
  {
    // if Menu is false then Menu and pause are set true, and vice versa
    this.Paused = this.Menu = !this.Menu;
    if (this.Menu) this.Interactive = true;
    PostInit();
    return this.Paused
  }
         /**
          * @brief This is for setting and getting Menu data
          * @notes
          * @return void (ambiguous)
          **/
         function _Menu()
  {
    if (Menu)
      {
        if (!blinker) blinker = setInterval(function ()
          {
            $('#PongTable #blink').fadeToggle(1000)
          }, 1000);
      }
    else
      {
        clearInterval(blinker);
        blinker = 0;
        return $('#PongTable #Menu').fadeOut(1000);
      }

    $('#PongTable #Level').val(this.Level);
    $('#PongTable #Player1Velocity').val(this.Player1Velocity);
    $('#PongTable #Player2Velocity').val(this.Player2Velocity);
    $('#PongTable #AI_difficulty').val(this.AI_difficulty);
    $('#PongTable #AI_player').val(this.AI_player);
    $('#PongTable #InputMethod').val(InputMethod);
    $('#PongTable #degreeOfMotion').val(this.degreeOfMotion);
    $('#PongTable #DualPaddles').attr('checked', this.DualPaddles);
    $('#PongTable #AutoLevelUp').attr('checked', this.AutoLevelUp);
    $('#PongTable #Interactive').attr('checked', this.Interactive);
    $('#PongTable #Paused').attr('checked', false);
    $('#PongTable #AI_player').attr('disabled', this.DualPaddles);
    $('#PongTable #link_velocity_of_players').attr('checked', this.link_velocity_of_players);

    switch (InputMethod)
      {
      case 'deviceorientation':
        $('#PongTable').find('#degreeOfMotion, #degreeOfMotionlabel').show();
        break;
      case 'keyup':
        $('#PongTable .PlayerVelocity').show();
        break;
      }

    $('#PongTable #Menu').fadeIn(1000);
  }
  /**
   * @brief This is our animation loop
   * @notes
   * @return void
   **/
  function play()
  {
    //var start = Date.now();
    if (!this.Paused) window.requestAnimationFrame(play);
    if (this.FixBoundary)
      {
        //console.log("FixBoundary");
        $p1.css('bottom', (window_height - parseInt($p1.css('top'))) - parseInt($p1.css('height')) + 'px');
        $p2.css('bottom', (window_height - parseInt($p2.css('top'))) - parseInt($p2.css('height')) + 'px');

        $ball.css('bottom', (window_height - parseInt($ball.css('top'))) - parseInt($ball.css('height')) + 'px');
        $ball.css('right', (window_width - parseInt($ball.css('left'))) - parseInt($ball.css('width')) + 'px');
      }
    // rather than calling these methods multiple times we set a varible to it's value to instead,and we reduce it to one call to optimize for speed
    ball_top = parseInt($ball.css('top'));
    ball_bottom = parseInt($ball.css('bottom'));
    ball_left = parseInt($ball.css('left'));
    ball_right = parseInt($ball.css('right'));

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

    if ((this.AI_player && !this.DualPaddles) || !this.Interactive)
      {
        if (!this.Interactive) this.AI_player = (this.ball_vx < 0) ? 1 : 2;
        if ((this.AI_player == 1 && this.ball_vx < 0) || (this.AI_player == 2 && this.ball_vx > 0))
          {
            var tmp_id = (this.AI_player == 1) ? $p1 : $p2;
            var ball_pos = ball_top - (parseInt($(tmp_id).css('height')) / 2) + AI_error * (this.ball_vy < 0 ? -1 : 1);
            var AI_vy = (InputMethod == 'keyup') ? (this.AI_player == 1 ? this.Player1Velocity : this.Player2Velocity) : 1;
            if (this.ball_vy < 0)
              {
                for (i = parseInt($(tmp_id).css('top')); i >= ball_pos; i -= AI_vy)
                  {
                    $(tmp_id).css('top', i + 'px');
                  }
              }
            else
              {
                for (i = parseInt($(tmp_id).css('top')); i <= ball_pos; i += AI_vy)
                  {
                    $(tmp_id).css('top', i + 'px');
                  }
              }
            if (parseInt($(tmp_id).css('top')) + parseInt($(tmp_id).css('height')) > window_height) $(tmp_id).css('top', (window_height - parseInt($(tmp_id).css('height'))) + 'px');
            if (parseInt($(tmp_id).css('top')) < 0) $(tmp_id).css('top', '0px');
          }
      }
    if (ball_top <= Math.abs(this.ball_vy) || ball_bottom <= Math.abs(this.ball_vy))
      {
        this.ball_vy *= -1;
      }
    if (!p2_hit && ball_top + Math.abs(this.ball_vy) >= p2_top && ball_bottom + Math.abs(this.ball_vy) >= p2_bottom && ball_right - Math.abs(this.ball_vx) <= p2_right + p2_width)
      {
        if (!this.DualPaddles)
          {
            $p2_score.text(parseInt($p2_score.text()) + 1);
            //console.log("score P2 +1");
          }
        else
          {
            $p1_score.text(parseInt($p1_score.text()) + 1);
          }
        this.ball_vx *= -1;
        if (this.AI_player == 2 || !this.Interactive)
          {
            SetAI_error(p1_height);
          }
        p1_hit = false;
        p2_hit = true;
        if (this.AutoLevelUp && !(parseInt($p1_score.text()) ^ 5)) speedup(0);
      }
    else
      {
        if (ball_right <= Math.abs(this.ball_vx))
          {
            if (this.AI_player == 2 || !this.Interactive)
              {
                SetAI_error(p2_height);
              }
            if (!this.DualPaddles)
              {
                $p1_score.text(parseInt($p1_score.text()) + 1);
              }
            else
              {
                $p2_score.text(parseInt($p2_score.text()) + 1);
              }
            // need to add serve code here
            ball_left = window_width / 2;
            ball_top = window_height / 2;
            p1_hit = false;
            p2_hit = false;
            if (this.AutoLevelUp)
              {
                this.Level = 0;
                speedup(0);
              }
          }
      }
    if (!p1_hit && ball_top + Math.abs(this.ball_vy) >= p1_top && ball_bottom + Math.abs(this.ball_vy) >= p1_bottom && ball_left - Math.abs(this.ball_vx) <= p1_left + p1_width)
      {
        $p1_score.text(parseInt($p1_score.text()) + 1);
        this.ball_vx *= -1;
        if (this.AI_player == 1 || !this.Interactive)
          {
            SetAI_error(p2_height);
          }
        p1_hit = true;
        p2_hit = false;
        if (this.AutoLevelUp && !(parseInt($p1_score.text()) ^ 5)) speedup(0);
      }
    else
      {
        if (ball_left <= Math.abs(this.ball_vx))
          {
            if (this.AI_player == 1 || !this.Interactive)
              {
                SetAI_error(p1_height);
              }
            $p2_score.text(parseInt($p2_score.text()) + 1);
            ball_left = window_width / 2;
            ball_top = window_height / 2;
            if (this.AutoLevelUp)
              {
                this.Level = 0;
                speedup(0);
              }
            p1_hit = false;
            p2_hit = false;
          }
      }

    ball_top  += this.ball_vy;
    ball_left += this.ball_vx;

    // reduced to one call for speed
    $ball.css(
    {
'top': ball_top + 'px',
'left': ball_left + 'px',
    });
    //console.log(Date.now() - start);
  }

  /**
   * @brief This is our dice roll for the error margin
   * @notes
   * @return void
   **/
  function SetAI_error(player_id)
  {
    AI_error = Math.random() * (2 * player_id * (1 - (this.AI_difficulty / 100))) * (Math.random() > 0.5 ? 1 : -1);
    //ball_vx  += Math.random() *  (Math.random() > 0.5 ? 1 : -1);
    //ball_vy  += Math.random() *  (Math.random() > 0.5 ? 1 : -1);
  }
  /**
   * @brief This is for linking * events to paddles
   * @notes very buggy at the moment
   * @return true
   **/
  function EventHandler(event)
  {
    if (!this.Interactive || event.type != InputMethod) return;
    switch (event.type)
      {
      case 'keyup':
        return KeyboardHandler(event);
      case 'mousemove':
        return MouseHandler(event);
      case 'touchstart':
      case 'touchmove':
      case 'touchend':
        return TouchHandler(event);
      case 'deviceorientation':
        return deviceorientationHandler(event);
      }
  }

  /**
   * @brief This is for linking gyro to paddles
   * @notes
   * @return true
   **/

  function deviceorientationHandler(event)
  {
    var $real_player = null;

    if (this.DualPaddles)
      {
        $real_player = $p1.add($p2);
      }
    else
      {
        $real_player = (this.AI_player == 1) ? $p2 : $p1;
      }
    $real_player.css('top', map(
                       constrain(
                         (Math.abs(window.orientation) == 90) ? event.gamma : event.beta, -this.degreeOfMotion,
                         this.degreeOfMotion
                       ), -this.degreeOfMotion, this.degreeOfMotion,
                       0, (window_height - parseInt($real_player.css('height')))
                     ) + 'px');
    return true;
  }

  /**
   * @brief This is for linking touch events to paddles
   * @notes
   * @return true
   **/
  function TouchHandler(event)
  {
    // half of screen allocated to P1, other half P2
    var $real_player = null;
    if (this.DualPaddles)
      {
        $real_player = $p1.add($p2);
      }
    else
      {
        $real_player = (event.changedTouches[event.changedTouches.length].pageX < window_width / 2) ? $p1 : $p2;
      }
    var y = Math.round((event.changedTouches[event.changedTouches.length].pageY - $(document).scrollTop()) - (parseInt($real_player.css('height')) / 2))
            $real_player.css('top', y + 'px');
    return true;
  }

  /**-
   * @brief This is for linking mouse to paddles
   * @notes
   * @return true
   **/
  function MouseHandler(event)
  {
    var $real_player = null;
    if (this.DualPaddles)
      {
        $real_player = $p1.add($p2);
      }
    else
      {
        $real_player = (this.AI_player == 1) ? $p2 : $p1;
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
  function KeyboardHandler(event)
  {
    //document.title=e.which;
    //document.title=String.fromCharCode(e.which);
    p1_top = parseInt($p1.css('top'));
    p1_bottom = parseInt($p1.css('bottom'));

    p2_top = parseInt($p2.css('top'));
    p2_bottom = parseInt($p2.css('bottom'));

    switch (event.which)
      {
      case 65:
        // a
        if (this.AI_player == 1) return;
        if (p1_top > 0)
          {
            p1_top -= this.Player1Velocity;
          }
        break;
      case 90:
        // z
        if (this.AI_player == 1) return;
        //console.log(p1_bottom, Player1Velocity, p1_bottom > Player1Velocity);
        if (p1_bottom > 0)
          {
            p1_top += this.Player1Velocity
          }
                  break;
      case 74:
        // j
        if (this.AI_player == 2) return;
        if (p2_top > 0)
          {
            p2_top -= this.Player2Velocity;
          }
        break;
      case 77:
        // m
        if (this.AI_player == 2) return;
        if (p2_bottom > 0)
          {
            p2_top += this.Player2Velocity
          }
                  break;
      }

    if (this.DualPaddles)
      {
        p1_top = p2_top;
      }

    $p1.css(
    {
'top': p1_top + 'px',
    });

    $p2.css(
    {
'top': p2_top + 'px',
    });

    return true;
  }

  function GlobalKeyboardHandler(event)
  {
    if (!this.Interactive) return;
    switch (event.which)
      {
      case 187:
        // +
        speedup(0);
        break;
      case 189:
        // -
        speedup(1);
        break;
      }
    return true;
  }
  /**
   * @brief This is a bugfix
   * @notes
   * @return void
   **/
  function parseBool(value)
  {
    if (value == null || value == "") return false;
    return (value.toLowerCase() == 'true' || value == '1');
  }

  /**
   * @brief constrains values to lbound..ubound
   * @notes
   * @return result
   **/
  function constrain(value, min, max)
  {
    if (value < min)
      {
        return min;
      }
    else if (value > max)
      {
        return max;
      }
    return value;
  }

  /**
   * @brief maps values to inMin..inMax to outMin..outMax
   * @notes
   * @return result
   **/
  function map(value, inMin, inMax, outMin, outMax)
  {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  }
}