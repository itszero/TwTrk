TwTrkCmd_Login = function(args) {
  this.delegate = null;
  this.want_input = false;
  this.run = function() {
    this.delegate.send_string("[PROMPT_BOT]");
    this.delegate.send_string("正在送您到 Twitter 認證...");
    setTimeout(function() {
      location.href = '/twitter_auth';
    }, 260);
  }
};

TwTrkCmd_Logout = function(args) {
  this.delegate = null;
  this.want_input = false;
  this.run = function() {
    this.delegate.send_string("[PROMPT_BOT]");
    this.delegate.send_string("感謝您的使用，再見！");
    setTimeout(function() {
      location.href = '/logout';
    }, 260);
  }
};

TwTrkCmd_SSL = function(args) {
  this.delegate = null;
  this.want_input = false;
  this.run = function() {
    this.delegate.send_string("[PROMPT_BOT]");
    this.delegate.send_string("正在啟動加密連線...");
    setTimeout(function() {
      location.href = 'https://twtrk.heroku.com/';
    }, 260);
  }  
}

TwTrkCmd_Help = function(args) {
  this.delegate = null;
  this.run = function() {
    this.delegate.send_string("[PROMPT_BOT]");
    this.delegate.send_string(" 可用指令列表：\r\n");
    this.delegate.send_string("  plurk         - 登入噗浪帳號\r\n");
    this.delegate.send_string("  sync (on|off) - 切換是否同步\r\n");
    this.delegate.send_string("  info          - 顯示使用者資訊\r\n");
    this.delegate.send_string("  help          - 可用指令列表\r\n");
    this.delegate.send_string("  logout        - 登出系統\r\n");
    this.delegate.send_string("\r\n");
    this.delegate.send_string("\033[1;37mTwTrk\033[m, \033[1;32mtwitter\033[m->\033[1;31mplurk\033[m syncing bot\r\n");
    this.delegate.send_string("Written by \033[1;31mZero\033[m 2011\r\n");
    this.delegate._cmd_finished();
  }
}

TwTrkCmd_Info = function(args) {
  this.delegate = null;
  this.args = args;
  this.run = function() {
    this.delegate.send_string("[PROMPT_BOT]");
    this.delegate.send_string("請稍後，查詢中...");
    var obj = this;
    $.ajax({
      type: 'get',
      url:'/info',
      dataType: 'json',
      success: function(data) {
        obj.delegate.send_string("\033[17D");
        obj.delegate.send_string("\033[K");
        obj.delegate.send_string("親愛的會員您好，您的資訊如下：\r\n");
        obj.delegate.send_string("  \033[1;32mTwitter\033[m 帳號： " + data.twitter_username + "\r\n");
        obj.delegate.send_string("    \033[1;31mPlurk\033[m 帳號： " + data.plurk_username + "\r\n");
        obj.delegate.send_string("      同步功能： [" + (data.should_sync ? "\033[1;32m開啟\033[m" : "\033[1;31m關閉\033[m") + "]\r\n");
        obj.delegate.send_string("      註冊日期： " + data.joined_at + "\r\n");
        obj.delegate.send_string("\r\n");
        obj.delegate.send_string("最後五筆同步記錄：\r\n");
        obj.delegate.send_string("結果 | 同步推特筆數 | 同步時間\r\n");
        obj.delegate.send_string("=====================================\r\n");
        for(var i=0;i<data.logs.length;i++)
        {
          obj.delegate.send_string((data.logs[i].result ? "\033[1;32m成功\033[m" : "\033[1;31m失敗\033[m") + " |");
          obj.delegate.send_string(" " + data.logs[i].synced_twits + " |");
          obj.delegate.send_string(" " + data.logs[i].synced_at + "\r\n");
        }
        if (data.logs.length == 0)
          obj.delegate.send_string("  沒有同步記錄\r\n");
        obj.delegate._cmd_finished();
      },
      error: function(xhr, ts, err) {
        obj.delegate.send_string("\033[17D");
        obj.delegate.send_string("\033[K");
        obj.delegate.send_string("連線\033[1;31m失敗\033[m，請稍後再試...\r\n");
        obj.delegate._cmd_finished();
      }
    });
  }
}

TwTrkCmd_Sync = function(args) {
  this.delegate = null;
  this.args = args;
  this.run = function() {
    if (this.args.size == 1)
    {
      this.delegate.send_string("[PROMPT_BOT]");
      this.delegate.send_string("說明：使用 sync on 開啟同步或是 sync off 關閉同步。")
    }
    else 
    {
      this.delegate.send_string("[PROMPT_BOT]");
      this.delegate.send_string("請稍後，設定中...");
      var obj = this;
      if (this.args[1] == "off")
      {
        $.ajax({
          type: 'get',
          url:'/set_sync?val=off',
          dataType: 'json',
          success: function(data) {
            obj.delegate.send_string("\033[17D");
            obj.delegate.send_string("\033[K");
            obj.delegate.send_string("同步功能已經 \033[1;31m關閉\033[m\r\n");
            obj.delegate._cmd_finished();
          },
          error: function(xhr, ts, err) {
            obj.delegate.send_string("\033[17D");
            obj.delegate.send_string("\033[K");
            obj.delegate.send_string("連線\033[1;31m失敗\033[m，請稍後再試...\r\n");
            obj.delegate._cmd_finished();
          }
        });
      }
      else
      {
        $.ajax({
          type: 'get',
          url:'/set_sync?val=on',
          dataType: 'json',
          success: function(data) {
            obj.delegate.send_string("\033[17D");
            obj.delegate.send_string("\033[K");
            if (data.status == 'ok')
              obj.delegate.send_string("同步功能已經 \033[1;32m啟動\033[m\r\n");
            else if (data.status == 'err')
            {
              if (data.msg == 'NEED_PLURK_CREDENTIALS')
                obj.delegate.send_string("無法啟動同步，請先使用 \033[1;31mplurk\033[m\r\n指令登入\033[1;31m噗浪\033[m。\r\n");
              else
                obj.delegate.send_string("不明錯誤，請稍後再試...\r\n");
            }
            obj.delegate._cmd_finished();
          },
          error: function(xhr, ts, err) {
            obj.delegate.send_string("\033[17D");
            obj.delegate.send_string("\033[K");
            obj.delegate.send_string("連線\033[1;31m失敗\033[m，請稍後再試...\r\n");
            obj.delegate._cmd_finished();
          }
        });
      }
    }
  }
}

TwTrkCmd_Plurk = function(args) {
  this.delegate = null;
  var obj = this;
  this.states = {
    WAIT_USERNAME: 'WAIT_USERNAME',
    WAIT_PASSWORD: 'WAIT_PASSWORD',
    WAIT_AUTH: 'WAIT_AUTH'
  };
  this.state = this.states.WAIT_USERNAME;
  this.run = function() {
    this.delegate.send_string("[PROMPT_BOT]");
    this.delegate.send_string("請輸入噗浪使用者名稱：\r\n  > ")
  }
  this.want_input = true;
  this.receiving_password = false;
  this.username = "";
  this.password = "";
  this.recv_line = function(str) {
    switch(this.state) {
      case this.states.WAIT_USERNAME:
        this.username = str;
        this.state = this.states.WAIT_PASSWORD;
        this.receiving_password = true;
        this.delegate.send_string("[PROMPT_BOT]");
        this.delegate.send_string("請輸入噗浪密碼：\r\n  請注意您的噗浪密碼\r\n  將以\033[1;31m明碼\033[m儲存在伺服器上。\r\n  > ")
        break;
      case this.states.WAIT_PASSWORD:
        this.password = str;
        this.state = this.states.WAIT_AUTH;
        this.want_input = false;
        this.delegate.send_string("[PROMPT_BOT]");
        this.delegate.send_string("請稍後驗證中...\r\n");
        var obj = this;
        $.ajax({
          type: 'post',
          url:'/plurk_auth',
          data: {username: this.username, password: this.password},
          dataType: 'json',
          success: function(data) {
            obj.delegate.send_string("[PROMPT_BOT]");
            obj.delegate.send_string("登入\033[1;32m成功\033[m，噗浪將開始同步！\r\n");
            obj.delegate._cmd_finished();
          },
          error: function(xhr, ts, err) {
            obj.delegate.send_string("[PROMPT_BOT]");
            obj.delegate.send_string("登入\033[1;31m失敗\033[m，請重新登入噗浪。\r\n");
            obj.delegate._cmd_finished();
          }
        });
        break;
    }
  }
};