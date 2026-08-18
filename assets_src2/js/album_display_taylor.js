YUI_config = {modules: {'gallery-scroll-beacon-wretch': {fullpath: 'http://pic.wretch.cc/e/serv/album/js/scroll-beacon-wretch.js', requires: ['event','event-custom','event-simulate','node']}}};
YUI().use('node', 'gallery-scroll-beacon-wretch', 'json-parse', 'io', 'imageloader', 'event-resize', function(Y){

	var	wall = Y.one('#wall')
	,   wall_header = Y.one('#wall-header')
	,	brick = Y.all('.brick')
	,	img_qty = brick.size()
	,	img_width = 200
	,	brick_margin = 10
	,	brick_padding = 10
	,	col_width = img_width + brick_padding * 2 + brick_margin * 2 // Image size + Padding + Margin
	,	max_qty = 400
	,	max_ratio = 1.78
	,	scale = 1.5
	,	page = 1
	,	loaded_qty = 1
	,	wall_width
	,	phi
	,	owner_id = Y.one('#owner_id').get('value')		
	,	book_id = Y.one('#book_id').get('value')
	,	crumb = Y.one('#wretch-crumb').get('value')
	,	qty_each_load = 25;

	Array.prototype.max = function(){var max = this[0];var len = this.length;for(var i = 1; i < len; i++){if(this[i] > max){max = this[i];};};return max;};
	Array.prototype.min = function(){var min = this[0];var len = this.length;for(var i = 1; i < len; i++){if(this[i] < min){min = this[i];};};return min;};
	if(!Array.indexOf){Array.prototype.indexOf = function(obj){for(var i=0; i<this.length; i++){if(this[i]==obj){return i;};};return -1;};};

	function imageReplacer(first_img_no, last_img_no, timeout){
		setTimeout(function(){
			var foldGroup = new Y.ImgLoadGroup({name: 'fold group', foldDistance: 250});
			for(var i = first_img_no; i <= last_img_no; i++){
				foldGroup.registerImage({ 
					domId: 'p' + i, 
					srcUrl: Y.one('#b' + i + ' a').getAttribute('rel')
				});
			};
		}, timeout);
	};

	function createPhi(col_qty){
		coords = new Array(col_qty - 1);
		for(var i = 0; i < col_qty; i++){
			coords[i] = 0;
		};
		return coords;
	};

	function iniWidth(){
		var	win_width = parseInt(Y.one('#wrapper').getComputedStyle('width'))
		,	col_qty = Math.floor(win_width/col_width);
		if(Y.UA.ie >= 7 && Y.UA.ie < 9){
			Y.one('#wall').delegate('mouseenter',function(){
				var left = parseInt(this.one('.link_image img').getComputedStyle('left'))
				,   height = parseInt(this.one('.link_image img').getComputedStyle('height'));
				this.one('.link_image').setStyle('width', img_width * scale + 'px');
				this.one('.link_image img').setStyles({
					'left': left * scale,
					'height': height * scale
				});
			},'.overflow-x');
			Y.one('#wall').delegate('mouseleave',function(){
				var left = parseInt(this.one('.link_image img').getComputedStyle('left'))
				,   height = parseInt(this.one('.link_image img').getComputedStyle('height'));
				this.one('.link_image').setStyle('width', img_width + 'px');
				this.one('.link_image img').setStyles({
					'left': left / scale,
					'height': height / scale
				});
			},'.overflow-x');
			Y.one('#wall').delegate('mouseenter',function(){
				var top = parseInt(this.one('.link_image img').getComputedStyle('top'))
				,   width = parseInt(this.one('.link_image img').getComputedStyle('width'));
				this.one('.link_image').setStyle('height', img_width * max_ratio * scale + 'px');
				this.one('.link_image img').setStyles({
					'top': top * scale,
					'width': width * scale
				});
			},'.overflow-y');
			Y.one('#wall').delegate('mouseleave',function(){
				var top = parseInt(this.one('.link_image img').getComputedStyle('top'))
				,   width = parseInt(this.one('.link_image img').getComputedStyle('width'));
				this.one('.link_image').setStyle('height', img_width * max_ratio + 'px');
				this.one('.link_image img').setStyles({
					'top': top / scale,
					'width': width / scale
				});
			},'.overflow-y');
			Y.one('#wall').delegate('mouseenter',function(){
				var left = parseInt(this.getComputedStyle('left'))
				,   top = parseInt(this.getComputedStyle('top'));
				this.setStyles({
					'top' : top + img_width * (1 - scale) / 2,
					'left': left + img_width * (1 - scale) / 2
				});
			},'.brick');
			Y.one('#wall').delegate('mouseleave',function(){
				var left = parseInt(this.getComputedStyle('left'))
				,   top = parseInt(this.getComputedStyle('top'));
				this.setStyles({
					'top' : top - img_width * (1 - scale) / 2,
					'left': left - img_width * (1 - scale) / 2
				});
			},'.brick');
			Y.one('head').appendChild('<style>'
				+'.brick{border:1px solid #ddd;}'
				+'.brick:hover{border:3px solid #999;}'
				+'.overflow-x:hover a img{width:auto!important;}'
				+'#wrapper{min-width:' + col_width * 3 + 'px!important;}'
				+'.caption{width:' + img_width + 'px;}'
				+'.brick:hover .caption{width:' + img_width * scale + 'px;}'
				+'.resize-normally.brick:hover img {width:' + img_width * scale + 'px!important;}'
				+'</style>');
		}else{
			Y.one('head').appendChild('<style>'
				+'#wrapper{min-width:' + col_width * 3 + 'px!important;}'
				+'.caption{width:' + img_width + 'px;}'
				+'.brick:hover{'
				+'transform:scale(' + scale + ', ' + scale + ');'
				+'-webkit-transform:scale(' + scale + ', ' + scale + ');'
				+'-moz-transform:scale(' + scale + ', ' + scale + ');'
				+'-o-transform:scale(' + scale + ', ' + scale + ');'
				+'-khtml-transform:scale(' + scale + ', ' + scale + ');'
				+'-ms-transform:scale(' + scale + ', ' + scale + ');'
				+'}'
				+'</style>');
			};
		wall_width = col_width * col_qty;
		wall.setStyle('width', wall_width);
		wall_header.setStyle('width', wall_width - 20);
		phi = createPhi(col_qty);
		buildWall(1, img_qty, phi);
		setTimeout(function(){Y.all('.wall_func').addClass('unveiled');}, 1000);
	};

	function rebuildOrNot(){
		if(img_qty <= max_qty){
			var	win_width = parseInt(Y.one('#wrapper').getComputedStyle('width'))
			,	col_qty = Math.floor(win_width/col_width)
			,	margin = win_width - wall_width;
			if (wall_width > win_width || margin > col_width){
				wall_width = col_width * col_qty;
				wall.setStyle('width', wall_width);
				wall_header.setStyle('width', wall_width - 20);
			};
			phi = createPhi(col_qty);
			buildWall(1, img_qty, phi);
		}else{
			return;
		};
	};

	function buildWall(start_brick, end_brick, phi){
		var x,y;
		for(var i = start_brick; i <= end_brick; i++){
			y = phi.min();
			x = col_width * phi.indexOf(y) + brick_margin;
			Y.one('#b' + i).setStyles({'left': x + 'px', 'top': y + 'px'});
			phi[phi.indexOf(y)] = y + parseInt(Y.one('#b' + i).getComputedStyle('height')) + brick_padding * 2 + brick_margin * 2;
		};
		wall.setStyle('height', phi.max() + 'px');
		if(page == 1){
			wall.addClass('built');
			setTimeout(function(){
				if(loaded_qty < qty_each_load){
					Y.one('.loadst').addClass('finished');
				};
			}, 1000);
		}else{
			return;
		};
	};

	var isloading = 0;
	function appendImg(id, o){
		if(isloading == 1){return;};
		isloading = 1;
		var data = Y.JSON.parse(o.responseText);
		loaded_qty = data.total;
		var msg = data.message;
		var imgs = '';
		if(loaded_qty != 0){
			Y.one('.loadst').addClass('ing');
			for(var i = 0; i < loaded_qty; i++){
				imgs	=	imgs
					+	'<div id="b' + (img_qty + 1) + '" class="brick ' + data.result[i].content_type + '">'
					+	'<a class="link_image" href="' + data.result[i].url + '" target="_blank" rel="' + data.result[i].source_url_large + '">'
					+	'<img src="' + data.result[i].source_url + '" id="p' + (img_qty + 1) + '" />'
					+	'</a>'
					+	'<div class="caption">'
					+	'<i></i>'
					+	'<a class="link_caption" href="' + data.result[i].url + '"><p>' + data.result[i].title + '</p></a>'
					+	'</div>'
					+	'</div>';
				img_qty++;
			};
			wall.appendChild(imgs);
			brick = Y.all('.brick');
			// -------------------------------- size handler
			var n = 0;
			for(var i = (img_qty - loaded_qty) + 1; i <= img_qty; i++){
				Y.one('#p' + i).on('load', function(){
					var	thumb_orig_width = parseInt(this.getComputedStyle('width'))
					,	thumb_orig_height = parseInt(this.getComputedStyle('height'))
					,	w_to_h = thumb_orig_width / thumb_orig_height
					,	h_to_w = thumb_orig_height / thumb_orig_width;
					if(w_to_h > max_ratio){
						this.ancestor('.link_image').setStyle('width', Math.floor(img_width));
						this.ancestor('.brick').addClass('overflow-x');
						this.setStyles({
							'left': Math.floor((img_width / max_ratio) * ((max_ratio - w_to_h) / 2)),
							'height': Math.floor(img_width / max_ratio)
						});
					}else if(h_to_w > max_ratio){
						this.ancestor('.link_image').setStyle('height', Math.floor(img_width * max_ratio));
						this.ancestor('.brick').addClass('overflow-y');
						this.setStyles({
							'top': Math.floor(img_width * ((max_ratio - h_to_w) / 2)),
							'width': img_width
						});
					}else{
						this.ancestor('.brick').addClass('resize-normally');
						this.setStyle('width', img_width);
					};
					n++;
					if(n == loaded_qty){
						Y.one('.loadst').removeClass('ing');
						if(page > 1){
							buildWall(img_qty - loaded_qty + 1, img_qty, phi);
							imageReplacer(img_qty - loaded_qty + 1, img_qty, 1000);
							page++;
							isloading = 0;
						}else{
							iniWidth();
							imageReplacer(1, img_qty, 0);
							page++;
							isloading = 0;
						};
					};
				});
			};
			// -------------------------------- size handler
		}else{
			if(msg == 'END'){
				Y.one('.loadst').addClass('finished');
				wall.addClass('built');
				setTimeout(function(){Y.all('.wall_func').addClass('unveiled');}, 1000);
			}else{
				Y.one('.loadst').addClass('restricted');
			}
			return;
		};
	};

	Y.on('windowresize', function(){rebuildOrNot();});
	Y.one('#flag').on('beacon:reached', function(){
		if(loaded_qty > 0 && isloading == 0){
			Y.io('/ajax/album/ajax_display_get_photos.php?i=' + owner_id + '&b=' + book_id + '&p=' + page + crumb);
		}else{
			return;
		}
	});
	Y.on('io:success', appendImg);
});
