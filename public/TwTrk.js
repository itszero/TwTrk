TwTrkBot = function(term) {
  /* constants */
  var USER_GUEST = 0;
  var USER_AUTHED = 1;

  var CMD_WAITCMD = 0;
  
  
  /* instance variables */
  this._term = term;
  this._send_buf = [];
  this._sending_lock = false;
  this._username = "";
  
  /* TermView delegate */
  this.send = function(data) {
    if (data.data == "\r")
      this._term.incomingData("\r\n");
    else if (data.data == "\b")
    {
      this._term.incomingData("\033[1D");
      this._term.incomingData("\033[K");
    }
    else
      this._term.incomingData(data.data);
    
    this._term.flushBuffer();
  }

  this.send_guest_greeting = function()
  {
    this.send_string("[PROMPT_BOT]");
    this.send_string("歡迎使用\033[1;33m噗浪推特\033[m同步機器人。\r\n");
    this.send_string("[PROMPT_BOT]");
    this.send_string("請輸入 \033[1;37mlogin\033[m 使用 Twitter 帳號驗證身分。\r\n");
    this.send_string("[PROMPT_USER]");
  }
  
  /* system init */
  var obj = this;
  $.get('/get_status', {}, function(data) {
    if (data.user_state == 'guest')
      obj._user_state = USER_GUEST;
    else
    {
      obj._user_state = USER_AUTHED;
      obj._username = data.username;
    }
      
    if (obj._user_state == USER_GUEST)
      obj.send_guest_greeting.apply(obj);
    else
      obj.send_user_greeting.apply(obj);
  }, 'json');
  
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
      this._term.incomingData("TwTrk> ");
      nextstr = "";
    }
    else if (str == "[PROMPT_USER]")
    {
      this._term.incomingData((this._username == "" ? "Guest> " : this._username + "> "));
      nextstr = "";
    }
    else
    {
      this._term.incomingData(str[0]);
    }
    this._term.flushBuffer();
    setTimeout(function() { obj.random_delay_send_text.apply(obj, [nextstr]); }, Math.random() * 10);
  }
}
