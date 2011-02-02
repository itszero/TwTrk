/*
 * TermView.js - JS Terminal Emulator
 * 
 * Author: Zero Cho (itszero@gmail.com)
 *
 */
TermView = function() {
    this._options = {
      screen_size: {w: 37, h: 15},
      grid_size: {w: 14, h: 27},
      cjk_font: {face: ['HiraginoSansGB-W3', '"Microsoft JhengHei"', 'sans'], size: 16, offset: {x: -4, y: -2}},
      ascii_font: {face: ['Monaco', 'Consolas', 'monospaace'], size: 16, offset: {x: 0, y: 0}},
      target: '#termview',
      terminal: TermView.Terminals.ANSI,
      renderer: TermView.Renderers.Canvas
    }
    
    this._terminal = new this._options.terminal(this._options);
    this._renderer = new this._options.renderer(this._options);

    var self = this;
    $('body').keydown(function(pEvent) {
      var a = null;
      if (!pEvent.ctrlKey && !pEvent.altKey && !pEvent.metaKey) {
        if (pEvent.keyCode == 13)
          a = '\r';
        else if (pEvent.keyCode == 8) // BS
          a = '\b';
        else if (pEvent.keyCode == 9) // TAB
        {
          a = '\t';
          pEvent.stopPropagation();
          pEvent.preventDefault();
        }
        else if (pEvent.keyCode == 27) // ESC
          a = '\x1b';
        else if (pEvent.keyCode == 33) // Page Up
          a = '\x1b[5~';
        else if (pEvent.keyCode == 34) // Page Down
          a = '\x1b[6~';
        else if (pEvent.keyCode == 35) // End
          a = '\x1b[4~';
        else if (pEvent.keyCode == 36) // Home
          a = '\x1b[1~';
        else if (pEvent.keyCode == 37) // Arrow Left
          a = '\x1b[D';
        else if (pEvent.keyCode == 38) // Arrow Up
          a = '\x1b[A';
        else if (pEvent.keyCode == 39) // Arrow Right
          a = '\x1b[C';
        else if (pEvent.keyCode == 40) // Arrow Down
          a = '\x1b[B';
        else if (pEvent.keyCode == 45) // Insert
          a = '\x1b[2~';
        else if (pEvent.keyCode == 46) // DEL
        {
          a = '\x1b[3~';
          // Safari would go back when DEL hitted.
          pEvent.stopPropagation();
          pEvent.preventDefault();
        }

        if (a)
        {
          self._delegate.send({type: 'key', data: a});
          return false;
        }
      }
      return true;
    }).keypress(function(pEvent) {
      var a = String.fromCharCode(pEvent.charCode);
      
      if (pEvent.ctrlKey && !pEvent.altKey && !pEvent.metaKey && !pEvent.shiftKey)
      {
        if (pEvent.charCode >= 65 && pEvent.charCode <= 90)
          self._delegate.send({type: 'key', data: String.fromCharCode(pEvent.charCode - 64)});
        else if (pEvent.charCode >= 97 && pEvent.charCode <= 122)
          self._delegate.send({type: 'key', data: String.fromCharCode(pEvent.charCode - 96)});
        pEvent.stopPropagation();
        pEvent.preventDefault();          
      }
      else if (!pEvent.ctrlKey && !pEvent.altKey && !pEvent.metaKey)
      {
        if (a)
          self._delegate.send({type: 'key', data: a});
      }
    });
    
    this._terminal.setDirtyCallback(this);
    this._renderer.setDelegate(this);
    this._bufferTimer = null;
    this._buffer = "";
    this._delegate = null;
}

TermView.prototype.setDelegate = function(obj) { this._delegate = obj; }

TermView.prototype.incomingData = function(rcvBuf) {
  clearTimeout(this._bufferTimer);
  this._buffer += rcvBuf;
  
  if (this._buffer.length < 1000)
  {
    var self = this;
    this._bufferTimer = setTimeout(function() {
      self._terminal.incomingData(self._buffer);
      self._buffer = "";
    }, 150);
  }
  else
  {
    this._terminal.incomingData(this._buffer);
    this._buffer = "";
  }
}

TermView.prototype.flushBuffer = function() {
  clearTimeout(this._bufferTimer);
  this._terminal.incomingData(this._buffer);
  this._buffer = "";
}

TermView.prototype.dataAt = function(x, y) { 
  var ydata = this._terminal.getScreenBuffer()[y];
  if (ydata == undefined)
    return undefined;
  return ydata[x];
}

TermView.prototype.terminalDidBecomeDirty = function(dirties) {
  this._renderer.updateScreen(dirties);
  this._renderer._caret = this._terminal._caret;
  this._renderer.drawCaret();
}

/* prepare namespaces */
TermView.Terminals = {}
TermView.Renderers = {}

/* utility functions */
TermView.isCJK = function(c)
{
  // 0x2605 = ★
  // 0x25A1 = □
  // 0x25CF = ●
  // 0x25CE = ◎
  // 0x02C7 = ˇ
  var extraset = [0x2013, 0x2014, 0x2025, 0x2026, 0x22ee, 0x22ef, 0x2500, 0x2502, 0x2048, 0x2049, 0x2605, 0x25A1, 0x25CF, 0x25CE, 0x02C7];

  var ch = c.charCodeAt(0);
  if (ch > 0x2E80)
    return true;
    
  if (extraset.indexOf(ch) > -1)
    return true;
  
  if (this.isSpecialSymbol(c)) return true;
  return false;
}

TermView.isSpecialSymbol = function(c)
{
  var ch = c.charCodeAt(0);

  // special symbols (courtesy of Nally)
  if (ch == 0x25FC)  // ◼ BLACK SQUARE
		return true;
	if (ch >= 0x2581 && ch <= 0x2588) // BLOCK ▁▂▃▄▅▆▇█
		return true;
	if (ch >= 0x2589 && ch <= 0x258F) // BLOCK ▉▊▋▌▍▎▏
		return true;
	if (ch >= 0x25E2 && ch <= 0x25E5) // TRIANGLE ◢◣◤◥
		return true;

	return false;
}