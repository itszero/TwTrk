TwTrkBot = function(term) {
  /* constants */
  var USER_GUEST = "USER_GUEST";
  var USER_AUTHED = "USER_AUTHED";

  /* instance variables */
  this._term = term;
  this._send_buf = [];
  this._sending_lock = false;
  this._user_state = null;
  this._username = "";
  this._cmdbuf = "";
  this._running_cmd = null;
  this._cmdset = {};
  this._cmdsets = {
    USER_GUEST: {
      'login': TwTrkCmd_Login,
      'ssl': TwTrkCmd_SSL,
      'SSL': TwTrkCmd_SSL,
    },
    USER_AUTHED: {
      'plurk': TwTrkCmd_Plurk,
      'sync': TwTrkCmd_Sync,
      'rt': TwTrkCmd_RT,
      'info': TwTrkCmd_Info,
      'help': TwTrkCmd_Help,
      'logout': TwTrkCmd_Logout
    }
  };
  
  /* TermView delegate */
  this.send = function(data) {
    if (!this._user_state || (this._running_cmd && !this._running_cmd.want_input))
      return;
    
    if (data.data == "\r")
    {
      this.send_string("\r\n");
      if (this._running_cmd != null && this._running_cmd.recv_line)
        this._running_cmd.recv_line(this._cmdbuf);
      else
      {
        this._cmdbuf = str_trim(this._cmdbuf);
        var args = this._cmdbuf.split(" ");
        var cmd = args[0];
        if (this._cmdset[cmd] != null)
        {
          var running_cmd = new this._cmdset[cmd](args);
          running_cmd.delegate = this;
          this._running_cmd = running_cmd;
          setTimeout(function() {
            running_cmd.run();
          }, 1);
        }
        else
        {
          this.send_string("[PROMPT_BOT]");
          this.send_string("呃... 我聽不懂你在說什麼耶，可以再告訴我一次嘛？\r\n");
          this.send_string("[PROMPT_USER]");
        }
      }
      this._cmdbuf = "";
    }
    else if (data.data == "\b")
    {
      if (this._cmdbuf.length > 0)
      {
        this.send_string("\033[1D");
        this.send_string("\033[K");
        this._cmdbuf = this._cmdbuf.substr(0, this._cmdbuf.length - 1);
      }
    }
    else
    {
      if (this._running_cmd && this._running_cmd.receiving_password)
        this.send_string("*");
      else
        this.send_string(data.data);
      this._cmdbuf += data.data;
    }
    
    this._term.flushBuffer();
  }
  
  this._cmd_finished = function() {
    this._running_cmd = null;
    this.send_string("[PROMPT_USER]");
  }

  this.send_guest_greeting = function()
  {
    this.send_string("[PROMPT_BOT]");
    this.send_string("歡迎使用\033[1;31m噗浪\033[m\033[1;32m推特\033[m同步機器人。\r\n");
    this.send_string("[PROMPT_BOT]");
    this.send_string("請輸入 \033[1;31mlogin\033[m 使用 Twitter 帳號驗證身分。\r\n");
    if (window.location.protocol != 'https:')
    {
      this.send_string('[PROMPT_BOT]');
      this.send_string('想使用 SSL 安全連線保護你\r\n的隱私？ 請輸入 \033[1;31mSSL\033[m 指令！\r\n');
    }
    this.send_string("[PROMPT_USER]");
  }

  this.send_user_greeting = function()
  {
    this.send_string("[PROMPT_BOT]");
    this.send_string("歡迎使用\033[1;31m噗浪\033[m\033[1;32m推特\033[m同步機器人。\r\n");
    this.send_string("[PROMPT_BOT]");
    this.send_string("Twitter 帳號確認完成，使用\r\n\033[1;31mplurk\033[m 指令登入噗浪後即可開始同步。\r\n");
    this.send_string("[PROMPT_BOT]");
    this.send_string("若有任何問題，請用 \033[1;31mhelp\033[m 指令。\r\n");
    this.send_string("[PROMPT_USER]");
  }
  
  this.send_msg_greeting = function(msgid)
  {
    if (msgid == "TWITTER_AUTH_FAILED")
    {
      this.send_string("[PROMPT_BOT]");
      this.send_string("認證失敗！");
      this.send_string("[PROMPT_BOT]");
      this.send_string("請輸入 \033[1;37mlogin\033[m 使用 Twitter 帳號驗證身分。\r\n");
      this.send_string("[PROMPT_USER]");
    }
  }
  
  /* private functions */
  this.send_string = function(str)
  {
    this._send_buf.push(str);
  }
  
  this.text_sending_task = function()
  {
    var obj = this;
    if (this._send_buf.length > 0)
    {
      if (!this._sending_lock)
        this.random_delay_send_text(this._send_buf.shift());
    }
    setTimeout(function() { obj.text_sending_task.apply(obj); }, 100);
  }
  this.text_sending_task();
  
  this.random_delay_send_text = function(str)
  {
    if (str.length == 0)
    {
      this._sending_lock = false;
      return;
    }
    
    this._sending_lock = true;
    var obj = this;
    var nextstr = str.substr(1, str.length);
    if (str == "[PROMPT_BOT]")
    {
      this._term.incomingData("\033[1;34mTwTrk\033[m> ");
      nextstr = "";
    }
    else if (str == "[PROMPT_USER]")
    {
      this._term.incomingData("\033[1;37m" + (this._username == "" ? "Guest> " : this._username + "\033[m> "));
      nextstr = "";
    }
    else
    {
      this._term.incomingData(str[0]);
    }
    this._term.flushBuffer();
    setTimeout(function() { obj.random_delay_send_text.apply(obj, [nextstr]); }, Math.random() * 5);
  }

  /* system init */
  var obj = this;
  this.send_string("請稍後，正在載入機器人程式中...");
  $.get('/get_status', {}, function(data) {
    if (data.user_state == 'guest')
      obj._user_state = USER_GUEST;
    else
    {
      obj._user_state = USER_AUTHED;
      obj._username = data.username;
    }
    
    obj._cmdset = obj._cmdsets[obj._user_state];
      
    obj.send_string('\033[1J');
    if (data.send_msg)
      obj.send_msg_greeting.apply(obj, [data.send_msg]);
    else if (obj._user_state == USER_GUEST)
      obj.send_guest_greeting.apply(obj);
    else
      obj.send_user_greeting.apply(obj);
  }, 'json');
}

// Author: Ariel Flesler
// http://flesler.blogspot.com/2008/11/fast-trim-function-for-javascript.html
// Licensed under BSD
function str_trim(str) {
  var start = -1,
  end = str.length;
  while (str.charCodeAt(--end) < 33);
  while (str.charCodeAt(++start) < 33);
  return str.slice(start, end + 1);
};