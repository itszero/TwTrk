/*
 * TermView.Renderers.Canvas.js - Canvas ANSI Renderer
 * 
 * Author: Zero Cho (itszero@gmail.com)
 *
 */

(function($){

TermView.Renderers.Canvas = function(opt) {
    
    // initalize variables
    this._caret = {x: 0, y: 0};
    this._lastDrawnCaret = {x: 0, y: 0};
    
    this._options = opt;
    
    this._ansi_color_palette = {
      'black': 'rgba(0, 0, 0, 1)',
      'red': 'rgba(205, 0, 0, 1)',
      'green': 'rgba(0, 205, 0, 1)',
      'yellow': 'rgba(205, 205, 0, 1)',
      'blue': 'rgba(0, 0, 238, 1)',
      'magneta': 'rgba(205, 0, 205, 1)',
      'cyan': 'rgba(0, 205, 205, 1)',
      'white': 'rgba(229, 229, 229, 1)',
      'lightblack': 'rgba(127, 127, 127, 1)',
      'lightred': 'rgba(255, 0, 0, 1)',
      'lightgreen': 'rgba(0, 255, 0, 1)',
      'lightyellow': 'rgba(255, 255, 0, 1)',
      'lightblue': 'rgba(92, 92, 255, 1)',
      'lightmagneta': 'rgba(255, 0, 255, 1)',
      'lightcyan': 'rgba(0, 255, 255, 1)',
      'lightwhite': 'rgba(255, 255, 255, 1)'
    } /* courtesy of xterm's color settings (grab from wikipedia) */
    this._symbol_drawing_func = {};
    
    this.drawing_screen = false;
    this._delegate = false;
    this._caretVisible = true;
    
    var obj = this;
    setInterval(function() { obj._blinkCaret.apply(obj); }, 500);
    
    // preapre DOM elements
    var view_size = {w: this._options.screen_size.w * this._options.grid_size.w, h: this._options.screen_size.h * this._options.grid_size.h};
    this._canvas = $('<canvas id="termview_canvas" width="' + view_size.w + 'px" height="' + view_size.h + 'px"></canvas>').appendTo(this._options.target);
    this._ctx = $(this._canvas).get(0).getContext('2d');
    if (!this._ctx)
      alert("Cannot get canvas 2D context, TermView won't work!");
    if (!this._ctx.fillText)
      alert("Oops, your browser does not support text drawing, TermView won't work!");

    // $(this._canvas).css('border', '1px solid #FFF'); 
}

TermView.Renderers.Canvas.prototype.setDelegate = function(obj) { this._delegate = obj; }
TermView.Renderers.Canvas.prototype._blinkCaret = function() {
  this._caretVisible = !this._caretVisible;
  this.drawCaret();  
}

/* Drawing */
TermView.Renderers.Canvas.prototype.clearScreen = function() {
  this._ctx.clearRect(0, 0, this._canvas.width(), this._canvas.height());
}

TermView.Renderers.Canvas.prototype.drawScreen = function() {
  if (this.drawing_screen) return;
  this.drawing_screen = true;

  for(var i=0;i<this._options.screen_size.h;i++)
    for (var j=0;j<this._options.screen_size.w;j++)
      this.renderCharAt(j, i);

  if (this._options.renderGrid) {
    for(var i=0;i<this._options.screen_size.h;i++)
    {
      for (var j=0;j<this._options.screen_size.w;j++)
      {
        var p = this.posToPoint(j, i);
        this._ctx.strokeStyle = "#FFF";
        this._ctx.strokeRect(p[0], p[1], this._options.grid_size.w, this._options.grid_size.h);
      }
    }
  }

  this.drawing_screen = false;
}

TermView.Renderers.Canvas.prototype.updateScreen = function(dirties) {
  if (this.drawing_screen) return;
  this.drawing_screen = true;
  
  var l = dirties.length;
  var now = new Date();
  for (var i=0;i<l;i++)
    this.renderCharAt(dirties[i][0], dirties[i][1]);

  this.drawing_screen = false;
}

TermView.Renderers.Canvas.prototype.renderCharAt = function(x, y) {
  var d = this._delegate.dataAt(x, y);
  if ( d == undefined ) return;
  
  var c = d[0] || "";
  d = d.split(";");
  var p = this.posToPoint(x, y);

  this._ctx.textBaseline = "bottom";
  this._ctx.strokeStyle = "";
  var fontStyle = null;

  if (this.isCJK(c))
  {
    fontStyle = this._options.cjk_font;
  }
  else
    fontStyle = this._options.ascii_font;
  
  var fg = "", bg = "";
  for(var z=1;z<d.length - 2;z++)
  {
    if (d[z] == "bright")
      fg = "light" + fg;
  }
  fg = fg + d[d.length - 2];
  bg = bg + d[d.length - 1];

  this._ctx.clearRect(p[0], p[1], ( this.isCJK(c) ? this._options.grid_size.w * 2 : this._options.grid_size.w ), this._options.grid_size.h);
  if (bg != "")
  {
    this._ctx.fillStyle = this.getColorCodeFromName(bg);
    this._ctx.fillRect(p[0], p[1], ( this.isCJK(c) ? this._options.grid_size.w * 2 : this._options.grid_size.w ), this._options.grid_size.h);
  }
  
  this._ctx.fillStyle = this.getColorCodeFromName(fg);
  if (this.isSpecialSymbol(c))
    this.drawSpecialSymbol(c, x, y);
  else
  {
    this._ctx.fontStyle = fontStyle.size + 'pt ' + fontStyle.face.join(", ");
    this._ctx.font = this._ctx.fontStyle;
    this._ctx.fillText(c, p[0] - fontStyle.offset.x, p[1] + this._options.grid_size.h + fontStyle.offset.y);
  }
}

TermView.Renderers.Canvas.prototype.getColorCodeFromName = function(name) {
  return this._ansi_color_palette[name] || "";
}

TermView.Renderers.Canvas.prototype.drawCaret = function() {
  // clean up last drawn caret
  this.renderCharAt(this._lastDrawnCaret.x, this._lastDrawnCaret.y);
  
  if (this._caretVisible)
    this._ctx.fillStyle = '#FFF';
  else
    this._ctx.fillStyle = '#000';
  var pt = this.caretToPoint();
  this._ctx.fillRect(pt[0], pt[1] + this._options.grid_size.h - 2, this._options.grid_size.w, 2);
  
  this._lastDrawnCaret = {x: this._caret.x, y: this._caret.y};
}

TermView.Renderers.Canvas.prototype.caretToPoint = function() {
  return this.posToPoint(this._caret.x, this._caret.y);
}

TermView.Renderers.Canvas.prototype.posToPoint = function(x, y) {
  return [x * this._options.grid_size.w, y * this._options.grid_size.h];
}

/* Symbols drawing */
TermView.Renderers.Canvas.prototype.drawSpecialSymbol = function(c, x, y) {
  var ch = c.charCodeAt(0);
  var pd = this.posToPoint(x, y), p = {x: pd[0], y:pd[1]}, sz = this._options.grid_size;

  if (ch == 0x25FC)  // ◼ BLACK SQUARE
    this._ctx.fillRect(p.x, p.y, sz.w * 2, sz.h);
  else if (ch >= 0x2581 && ch <= 0x2588) // BLOCK ▁▂▃▄▅▆▇█
    this._ctx.fillRect(p.x, p.y + sz.h * (8 - (ch - 0x2580)) / 8, sz.w * 2, sz.h * (ch - 0x2580) / 8);
  else if (ch >= 0x2589 && ch <= 0x258F) // BLOCK ▉▊▋▌▍▎▏
    this._ctx.fillRect(p.x, p.y, sz.w * 2 * (8 - (ch - 0x2589)) / 8, sz.h);
  else if (ch >= 0x25E2 && ch <= 0x25E5) // TRIANGLE ◢◣◤◥
	{
	  switch (ch)
	  {
	    case 0x25E2:
  	    this._ctx.save();
  	    this._ctx.beginPath();
  	    this._ctx.moveTo(p.x, p.y + sz.h);
  	    this._ctx.lineTo(p.x + sz.w * 2, p.y + sz.h);
  	    this._ctx.lineTo(p.x + sz.w * 2, p.y);
  	    this._ctx.lineTo(p.x, p.y + sz.h);
  	    this._ctx.fill();
  	    this._ctx.closePath();
  	    this._ctx.restore();
  	    break;
	    case 0x25E3:
  	    this._ctx.save();
  	    this._ctx.beginPath();
  	    this._ctx.moveTo(p.x, p.y);
  	    this._ctx.lineTo(p.x, p.y + sz.h);
  	    this._ctx.lineTo(p.x + sz.w * 2, p.y + sz.h);
  	    this._ctx.lineTo(p.x, p.y);
  	    this._ctx.fill();
  	    this._ctx.closePath();
  	    this._ctx.restore();
  	    break;
	    case 0x25E4:
  	    this._ctx.save();
  	    this._ctx.beginPath();
  	    this._ctx.moveTo(p.x, p.y);
  	    this._ctx.lineTo(p.x, p.y + sz.h);
  	    this._ctx.lineTo(p.x + sz.w * 2, p.y);
  	    this._ctx.lineTo(p.x, p.y);
  	    this._ctx.fill();
  	    this._ctx.closePath();
  	    this._ctx.restore();
  	    break;
	    case 0x25E5:
  	    this._ctx.save();
  	    this._ctx.beginPath();
  	    this._ctx.moveTo(p.x, p.y);
  	    this._ctx.lineTo(p.x + sz.h, p.y);
  	    this._ctx.lineTo(p.x + sz.w * 2, p.y + sz.h);
  	    this._ctx.lineTo(p.x, p.y);
  	    this._ctx.fill();
  	    this._ctx.closePath();
  	    this._ctx.restore();
  	    break;
	  }
	}
}

TermView.Renderers.Canvas.prototype.isCJK = function(c) { return TermView.isCJK(c); }
TermView.Renderers.Canvas.prototype.isSpecialSymbol = function(c) { return TermView.isSpecialSymbol(c); }

}(jQuery));
