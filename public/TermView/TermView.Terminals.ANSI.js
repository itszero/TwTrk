/*
 * TermView.Terminals.ANSI.js - ANSI Terminal emulator
 *   - Note that this is a UTF-8 terminal emulator
 *
 * Author: Zero Cho (itszero@gmail.com)
 */

TermView.Terminals.ANSI = function(opt) {
    // initalize variables
    this._caret = {x: 0, y: 0};
    
    this._options = opt;
    
    ANSI_PARSE_NORMAL = 0;
    ANSI_PARSE_WAIT_LEFT_BRACKET = 1;
    ANSI_PARSE_WAIT_COMMAND = 2;
    this._ansi_parse_state = ANSI_PARSE_NORMAL;
    this._ansi_parse_buffer = "";
    this.resetANSIattributes();
    
    this.incoming_buf = [];
    this.processing_buf = false;
    this.dirty_cb = null;
    
    this._screenbuf = [];
    for(var i=0;i<this._options.screen_size.h;i++)
    {
      var a = [];
      for(var j=0;j<this._options.screen_size.w;j++)
        a.push("");

      this._screenbuf.push(a);
    }
    
    this._dirties = [];
}

TermView.Terminals.ANSI.prototype.setDirtyCallback = function(obj) { this.dirty_cb = obj; }
TermView.Terminals.ANSI.prototype.getScreenBuffer = function() { return this._screenbuf; }

/* Data input handling */
TermView.Terminals.ANSI.prototype.incomingData = function(recvBuf) {
  this.incoming_buf.push(recvBuf);
  
  var t = this;
  if (!this.processing_buf)
  {
    this.processing_buf = true;
    setTimeout(function() { t.processData(); }, 0);
  }
}

TermView.Terminals.ANSI.prototype.processData = function() {
  var buf = this.incoming_buf.shift();
  
  for (var di=0,dl=buf.length;di<dl;di++)
  {
    var s = buf[di];
    switch(this._ansi_parse_state) {
    case ANSI_PARSE_NORMAL:
      if (s == "\033")
        this._ansi_parse_state = ANSI_PARSE_WAIT_LEFT_BRACKET;
      else if (s.charCodeAt(0) == 8) // ^H
        this._caret.x--;
      else
        this.putc(s);
      break;
    case ANSI_PARSE_WAIT_LEFT_BRACKET:
      if (s == "[")
      {
        this._ansi_parse_state = ANSI_PARSE_WAIT_COMMAND;
        this._ansi_parse_buffer = "";
      }
      else if (s == "\033")
        break;
      else
      {
        this.putc(s);
        this._ansi_parse_state = ANSI_PARSE_NORMAL;
      }
      break;
    case ANSI_PARSE_WAIT_COMMAND:
      this._ansi_parse_state = ANSI_PARSE_NORMAL;
      switch(s) {
      case 'F':
      case 'A':
        if (this._ansi_parse_buffer == "") this._ansi_parse_buffer = "1";
        this._caret.y-=parseInt(this._ansi_parse_buffer);
        if (s == 'F') this._caret.x = 0;
        break;
      case 'E':
      case 'B':
        if (this._ansi_parse_buffer == "") this._ansi_parse_buffer = "1";
        this._caret.y+=parseInt(this._ansi_parse_buffer);
        if (s == 'E') this._caret.x = 0;
        break;
      case 'C':
        if (this._ansi_parse_buffer == "") this._ansi_parse_buffer = "1";
        this._caret.x+=parseInt(this._ansi_parse_buffer);
        break;
      case 'D':
        if (this._ansi_parse_buffer == "") this._ansi_parse_buffer = "1";
        this._caret.x-=parseInt(this._ansi_parse_buffer);
        break;
      case 'G':
        if (this._ansi_parse_buffer == "") break;
        this._caret.x = parseInt(this._ansi_parse_buffer);
        break;
      case 'f':
      case 'H':
        var data = this._ansi_parse_buffer.split(";");
        while(data.length < 2)
          data.push("");
        if (data[0] == "") data[0] = "1";
        if (data[1] == "") data[1] = "1";
        var x = parseInt(data[1] - 1), y = parseInt(data[0] - 1);
        if (x >= this._options.screen_size.w)
          x = this._options.screen_size.w - 1;
        if (y >= this._options.screen_size.h)
          y = this._options.screen_size.h - 1;
        this._caret.y = y;
        this._caret.x = x;
        break;
      case 'J':
        if (this._ansi_parse_buffer == "") this._ansi_parse_buffer = "0";
        var type = parseInt(this._ansi_parse_buffer);
        for(var i=0;i<this._options.screen_size.w;i++)
        {
          for(var j=0;j<this._options.screen_size.h;j++)
          {
            if ( (type == 0 && ( (j == this._caret.y && i >= this._caret.x) || (j > this._caret.y) ) ) ||
                 (type == 1 && ( (j == this._caret.y && i <= this._caret.x) || (j < this._caret.y) ) ) ||
                 (type == 2) )
            {
              this._screenbuf[j][i] = '';
              this._dirties.push([i, j]);
            }
          }
        }
        
        /* though return to Left-Top corner is not specified, but seems many BBS-oriented terminal
           implements this. */
        this._caret.x = 0; this._caret.y = 0;
        break;
      case 'K':
        if (this._ansi_parse_buffer == "") this._ansi_parse_buffer = "0";
        var type = parseInt(this._ansi_parse_buffer);
        for(var i=0;i<this._options.screen_size.w;i++)
        {
          if ( (type == 0 && i >= this._caret.x) ||
               (type == 1 && i <= this._caret.x) ||
               (type == 2) )
          {
            this._screenbuf[(this._caret.y >= this._options.screen_size.h ? this._options.screen_size.h - 1 : this._caret.y)][i] = '';
            this._dirties.push([i, (this._caret.y >= this._options.screen_size.h ? this._options.screen_size.h - 1 : this._caret.y)]);
          }
        }
        break;
      case 'm':
        if (this._ansi_parse_buffer == "" || this._ansi_parse_buffer == "0")
          this.resetANSIattributes();
        else
        {
          var d = this._ansi_parse_buffer.split(";");
          for(var i=0;i<d.length;i++)
          {
            var val = parseInt(d[i]);
            if (val == 1)
              this._ansi_current_attributes.bright = true;
            else if (val == 7)
            {
              t = this._ansi_current_attributes.foreground;
              this._ansi_current_attributes.foreground = this._ansi_current_attributes.background;
              this._ansi_current_attributes.background = t;
            }
            else if (val >= 30 && val <= 37 || val == 39)
              this._ansi_current_attributes.foreground = this.getANSIColorFromCode((val != 39 ? val - 30 : 7));
            else if (val >= 40 && val <= 47 || val == 49)
              this._ansi_current_attributes.background = this.getANSIColorFromCode((val != 49 ? val - 40 : 0));
          }
        }
        break;
      default:
        this._ansi_parse_buffer += s;
        this._ansi_parse_state = ANSI_PARSE_WAIT_COMMAND;
        break;
      }
    }
    s = null;
  }
  
  buf = null;
  
  var self = this;
  if (this.incoming_buf.length > 0)
    setTimeout(function() { self.processData(); }, 0);
  else
    this.processing_buf = false;

  this.dirty_cb.terminalDidBecomeDirty(this._dirties);
  this._dirties = [];
}

TermView.Terminals.ANSI.prototype.getANSIColorFromCode = function(code) {
  var arr = ['black', 'red', 'green', 'yellow', 'blue', 'magneta', 'cyan', 'white'];
  return arr[code] || 'white';
}

TermView.Terminals.ANSI.prototype.resetANSIattributes = function() {
  this._ansi_current_attributes = {
    bright: false,
    foreground: 'white',
    background: 'black'
  };
}

TermView.Terminals.ANSI.prototype.ansiAttributesToString = function() {
  var s = [];
  if (this._ansi_current_attributes.bright)
    s.push("bright");
    
  s.push(this._ansi_current_attributes.foreground);
  s.push(this._ansi_current_attributes.background);
  return s.join(";");
}

TermView.Terminals.ANSI.prototype.putc = function(s) {
  if (s == "\r") {
    this._caret.x = 0;
  }
  else if (s == "\n") {
    this._caret.y++;
  }
  else if (s == "\t") {
    this._caret.x = (this._caret.x - (this._caret.x % 4)) / 4 + 4;
    if (this._caret.x >= this._options.screen_size.w)
      this._caret.x = this._options.screen_size.w - 1;
  }
  else if (s == "\b") {
    this._caret.x--;
    if (this._caret.x < 0) this._caret.x = 0;
  }
  else
  {
    /* if x, y is out of bound, shift first line out and put
       a new line into buffer, this is put here to postpone
       the action of create a newline until something really
       goes in that row. */
  
    /* if x is out of bound, wrap it to a new line */
    if (this._caret.x >= this._options.screen_size.w)
    {
      this._caret.x = 0;
      this._caret.y++;
    }  

    if (this._caret.y >= this._options.screen_size.h)
    {
      this._caret.x = 0;
      while(this._caret.y >= this._options.screen_size.h)
      {
        this._caret.y--;
        this._screenbuf.shift();
        var a = [];
        for(var j=0;j<this._options.screen_size.w;j++)
          a.push("");

        this._screenbuf.push(a);
        for(var j=0;j<this._options.screen_size.w;j++)
          this._dirties.push([j, this._caret.y]);
      }
    }

    this._screenbuf[this._caret.y][this._caret.x] = s + ";" + this.ansiAttributesToString();
    this._dirties.push([this._caret.x, this._caret.y]);
    
    if (this.isCJK(s))
    {
      // if this is CJK character, its right neighbor should be empty
      if (this._caret.x+1 < this._options.screen_size.w)
        this._screenbuf[this._caret.y][this._caret.x+1] = "";
      this._caret.x+=2;
    }
    else
    {
      // if this is not CJK, its left neightbor can't be CJK char
      if (this._caret.x-1 > 0 && this._screenbuf[this._caret.y][this._caret.x-1][0] != undefined && this.isCJK(this._screenbuf[this._caret.y][this._caret.x-1][0]))
      {
        this._screenbuf[this._caret.y][this._caret.x-1] = "";
        this._dirties.push([this._caret.x-1, this._caret.y]);
      }
      this._caret.x++;
    }
  }
}

TermView.Terminals.ANSI.prototype.isCJK = function(c) { return TermView.isCJK(c); }