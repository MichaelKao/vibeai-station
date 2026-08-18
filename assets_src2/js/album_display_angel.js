var YUI_config = {
    modules: {
				 'gallery-scroll-beacon-wretch': {
					 fullpath: 'http://pic.wretch.cc/e/serv/album/js/scroll-beacon-wretch.js',
					 requires: ['event','event-custom','event-simulate','node']
				 }
			 }
};
YUI().use('transition','event-resize','node','event-mouseenter','imageloader','event-mousewheel','datasource-io', 'datasource-jsonschema','gallery-scroll-beacon-wretch',function(Y){             
    var margin_left = 40,margin_right = 44,margin_top = 115;
    var img_index = 0,loader_index = 1,
        img_count = Y.all('.montage').size()-1, //numbers of images excluding cover image
        ini_img_height = 200,
        scale_array = [0.9,1,1.1],
        row_scale = new Array(),
        row_height = new Array(),
        cover_row = 2,
        cover_width = 250,
        cover_height = ini_img_height *cover_row+2,
        title_height = 20,
        total_row =1,
        SCALE = 1.6, //enlarge rate when mouse enter
        cover_width_adj =2,
        img_x = new Array(),
		img_y = new Array(),
		row_start = new Array(),
		row_end = new Array(),
		ini_img_width = new Array(),
		adj_img_width = new Array(),
		display_img_width = new Array(),
		display_img_height = new Array(),
		img_diff = new Array(),
		page=2,
		non_ajax_img_count = 25, //img number of ajax loaded per page
		kukubar_height,
		MIN_WIDTH = 20,
        ENDSPACE_HEIGHT = 100,
	    viewportHeight,
		viewportWidth = 0,
		viewportWidth_ = 0,
		RS_MIN_WIDTH;
    if(null !== Y.one('#kukubar-upper')){
		kukubar_height = parseInt(Y.one('#kukubar-upper').getComputedStyle('height'), 10);
	}else{
		kukubar_height = 31;
	}
    Y.on('domready',function(){
        var cover_height_adj = 0;
        /**handling the case with no photo in the album**/
        if(null === Y.one('#cover')){
           Y.one('#loading_sign').addClass('done');
		   Y.one('#imgTable').addClass('done');
		   Y.one('#loading_mask').addClass('done');
           Y.one('.all-func').addClass('show-func');
		   Y.one('#endSpace').setContent('這本相簿沒有照片喔!');
           Y.one('#endSpace').setStyles({
                'top': kukubar_height + margin_top + 'px',
                'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px',
			    'display':'block'
		   });
		   Y.one('body').setStyle('background','none repeat scroll 0 0 #333333');
		   /* adjust hugewrapper height*/
		   viewportHeight = Y.one('body').get('winHeight');
		   if(viewportHeight > (kukubar_height + margin_top + ENDSPACE_HEIGHT)){
			   Y.one('#hugewrapper .container').setStyles({
				   'height': viewportHeight + 'px',
				   'width': parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
			   });
		   }else{
			   Y.one('#hugewrapper .container').setStyles({
				   'height': kukubar_height + margin_top + ENDSPACE_HEIGHT + 'px',
				   'width': parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
			   });
		   } 
		   /* The End of adjust hugewrapper height*/

        }
		/**The End of handling the case with no photo in the album**/
		if(null !== Y.one('.montage')){
			Y.all('.montage').each(function(){
				if(img_index == 0){
					this.removeClass('montage');
				}else{
					this.setAttribute('id',('i'+img_index));
				}    
				img_index+=1;
			});
		}
		
        if(null !== Y.one('#cover')){
             
			 Y.one('#cover').one('img').setStyles({'height':cover_height+'px','background':'#fff'});
			 Y.one('#cover').setStyles({
				 'height':cover_height-cover_height_adj+'px',
				 'width':parseInt(Y.one('#cover').one('img').getComputedStyle('width'), 10)
			 });

			 /*handling cover img with width over 1/3 viewport width*/
			 if(parseInt(Y.one('#cover').one('img').getComputedStyle('width'), 10) > Math.round(parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)/3)){
				 Y.one('#cover').setStyles({
					 'width':Math.round(parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)/3)+'px'
				 });
				 Y.one('#cover').one('img').setStyles({'left': (Math.round(parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)/3)-parseInt(Y.one('#cover').one('img').getComputedStyle('width'), 10))*0.5  +'px'});
			 }
			 /*The End of handling cover img with width over 1/3 viewport width*/

			 Y.one('#cover').one('img').set('src',Y.one('#cover').one('img').getAttribute('src2'));
             if(Y.one('#cover').one('p').hasClass('type_video') && !Y.one('#cover').one('p').one('img')){
                 Y.one('#cover').one('.type_video').prepend('<img src="http://pic.wretch.cc/e/serv/album/img/cam30.png" style="margin-right:5px;"/>'); 
			 }
		
			cover_width = parseInt(Y.one('#cover').getComputedStyle('width'), 10) || 0;
			RS_MIN_WIDTH = cover_width + 100 + margin_left + margin_right;
		}
        for(var i=1;i<=img_count;i++){
			if(null !== Y.one('#i'+i)){
				Y.one('#i'+i).setStyle('height',ini_img_height+'px');
				Y.one('#i'+i).setAttribute('iniWidth',parseInt(Y.one('#i'+i).one('img').getComputedStyle('width'), 10));
				Y.one('#i'+i).one('img').setStyle('height',ini_img_height+'px');
				Y.one('#i'+i).one('img').setAttribute('id','loader'+i);
				ini_img_width[i] = parseInt(Y.one('#i'+i).one('img').getComputedStyle('width'), 10);
				adj_img_width[i] = parseInt(Y.one('#i'+i).one('img').getComputedStyle('width'), 10);
			}
		}
        //set row_scale
        for(var i=1;i<400;i++){
            row_scale[i] = scale_array[random_num(scale_array.length-1,0)];
        }
    });
    var padding = 2,border = 2,win_size,x,y;    
	var support = (function(){
		var     div = document.createElement('div'),
		vendors = 'Khtml Ms O Moz Webkit'.split(' '),
		len = vendors.length;
	return function(prop){
		if(prop in div.style){return true;};
		prop = prop.replace(/^[a-z]/, function(val){
			return val.toUpperCase();
		});
		while(len--){
			if(vendors[len] + prop in div.style){
				return true;
			};
		};
		return false;
	};
	})();
	support = support('transform');
	Y.on(['windowresize','domready'],function(e){
			viewportWidth_ = Y.one('body').get('winWidth');
			if(viewportWidth != viewportWidth_ && viewportWidth_ > RS_MIN_WIDTH){
            win_size = parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)-margin_left-margin_right-cover_width-padding,
            x = margin_left+cover_width+padding,
            y = kukubar_height + margin_top,
            img_width_sum = 0,anchor = 1,row=1;
			img_count = Y.all('.montage').size();

        for(var i=1;i<=img_count;i++){
            adj_img_width[i] = ini_img_width[i];
			if(null !== Y.one('#i'+i)){
				if(Y.one('#i'+i).hasClass('left'))
					Y.one('#i'+i).removeClass('left');
				if(Y.one('#i'+i).hasClass('right'))
					Y.one('#i'+i).removeClass('right');
				if(Y.one('#i'+i).hasClass('unhide'))
					Y.one('#i'+i).removeClass('unhide');
				for(var j=1;j<=total_row;j++){
					Y.one('#i'+i).removeClass('row'+j);
				}
				if(Y.one('#i'+i).hasClass('bc')){
					Y.one('.bc').detachAll();
					Y.one('#i'+i).removeClass('bc');

				}
			}
        }
        //hadle img width with extreme value
        
            adjIniWidth(1,img_count);
               
			adjustImg(0,1,img_count,0,win_size);//adjustImg(img_width_sum,start_id,img_count,start_row);
			arrangeImg( kukubar_height +margin_top,1,total_row);//arrangeImg(y,start_row,total_row);


			Y.one('#imgTable').delegate('mouseenter',function(){

				var id = this.get('id').slice(1);
				var row_str= this.getAttribute('class').split(" ");
				for(var i=0;i<row_str.length;i++){
					if(row_str[i].match('row')){
						var row = row_str[i].slice(4);
					}
				}

				if(support){	
					this.one('p').setStyles({
						'display':'block'
					});

					if(this.hasClass('left')){
						Y.one('#i'+id).setStyle('left',img_x[id]+ Math.ceil((display_img_width[id]*SCALE-adj_img_width[id])*0.5)+'px');
					}

					if(this.hasClass('right')){
						Y.one('#i'+id).setStyle('left',img_x[id]- Math.ceil((display_img_width[id]*SCALE-adj_img_width[id])*0.5)-14+'px');
					}
				}else{
					this.one('img').setStyles({
						'height':Math.round(display_img_height[id]*SCALE)+'px',
						'width':Math.round(display_img_width[id]*SCALE)+'px',
						'left':-(Math.round(display_img_width[id]*SCALE)-adj_img_width[id])/2+'px',
						'top':-(SCALE*10 *2) + 'px'

					});
					this.one('p').setStyles({
						'display':'block',
						'width':Math.round(display_img_width[id]*SCALE)+'px',
                        'left':-(Math.round(display_img_width[id]*SCALE)-adj_img_width[id])/2+'px',
						'top':-(SCALE*10 *2) + 'px'
					});	
					if(this.hasClass('left')){
					    Y.one('#i'+id).setStyle('left',img_x[id]+ Math.ceil((display_img_width[id]*SCALE-adj_img_width[id])*0.5)-7+'px');
                    }

					if(this.hasClass('right')){
						Y.one('#i'+id).setStyle('left',img_x[id]- Math.ceil((display_img_width[id]*SCALE-adj_img_width[id])*0.5)+'px');
					}	
				}

				this.one('img').setStyles({
					'border':'#fff solid 7px'
				});
			
				
				




			},'.montage');

			Y.one('#imgTable').delegate('mouseleave',function(){
				var id = this.get('id').slice(1);
				this.one('p').setStyle('display','none');
				this.one('img').setStyle('border','0px');

				if(!support){
					this.one('img').setStyles({
						'height':display_img_height[id]+'px',
						'width':display_img_width[id]+'px',
						'left':img_diff[id]+'px',
						'top':'0px'

					});
				}
			
				if(this.hasClass('left')){
					Y.one('#i'+id).setStyle('left',img_x[id]);
				}

				if(this.hasClass('right')){
					Y.one('#i'+id).setStyle('left',img_x[id]);
				}



			},'.montage');

        if(null !== Y.one('.cover')){
			Y.one('.cover').one('p').addClass('cover_title');
			Y.one('.cover').on('mouseenter', function () {
				this.one('p').setStyles({
					'top':'320px',
					'width':parseInt(Y.one('#cover').one('img').getComputedStyle('width'), 10)+'px',
					'height':'100px'
				});
			});
			Y.one('.cover').on('mouseleave',function(){
				this.one('p').setStyles({
					top:'400px'
				});
			});
		}
		//original-sized images loaded
			var foldGroup = new Y.ImgLoadGroup({ name: 'fold group', foldDistance:25 });
			for(var i=1;i<=img_count;i++){
				if(null !== Y.one('#loader'+i)){
					foldGroup.registerImage({ 
						domId: 'loader'+i, 
						srcUrl: Y.one('#loader'+i).getAttribute('src2')
					});
				}
			}
		
        Y.one('#loading_sign').addClass('done');
		if(null !== Y.one('#loading_mask')){
			Y.one('#loading_mask').remove();
		}
        Y.one('#imgTable').addClass('done');
		Y.one('.all-func').addClass('show-func');
        Y.one('body').setStyle('background','none repeat scroll 0 0 #333333');
		}
		viewportWidth = Y.one('body').get('winWidth');
  	});
   
    function adjIniWidth(start_index,end_index){
        for(var j = start_index;j <= end_index;j++){
            adj_img_width[j] = ini_img_width[j];
			if(ini_img_width[j]/ini_img_height > 1.74){
                adj_img_width[j] = parseInt(ini_img_height * 1.74, 10);
			}
        }
        
    }
    function random_num(maxNum,minNum){
        return Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
    }
    function adj_width(start_index,end_index,sum,win,row){
        do{
			/**xxs**/
			if(adj_img_width[start_index] > MIN_WIDTH){
				-- adj_img_width[start_index];
				--sum;
			}
            /**the end of xxs**/
			if(!(Y.one('#i'+start_index).getAttribute('class').match('row')) && !(Y.one('#i'+start_index).hasClass('row'+row))){
					Y.one('#i'+start_index).addClass('row'+row);
			}
		    ++ start_index;
        }while(sum != win && start_index <= end_index);
        return sum;
    }

    function adjustImg(img_width_sum,anchor,img_count,row,ini_win_size){
		if(null === Y.one('.unhide')){row+=1;}/** check uhide before append**/
		for(var i=anchor;i<=img_count;i++){
			if(row > cover_row){ //space available varies when the row exceeding cover image
				win_size = ini_win_size+cover_width;
				if('undefined' == row_scale[row]){
					row_scale = 1;
				}
				row_height[row] = Math.floor(ini_img_height *row_scale[row]);
				adj_img_width[i] = Math.floor(adj_img_width[i]*row_scale[row]);
			}else{
				row_scale[row] = 1;
				row_height[row] = ini_img_height;
			}
			img_width_sum += adj_img_width[i];
			if(img_width_sum > win_size){
				row_start[row]=anchor;
				row_end[row]=i;
				// adj img width untile the sum equals to window size
				do{
					img_width_sum = adj_width(anchor,i,img_width_sum,win_size,row);
				}while(img_width_sum > win_size);
				if(row>cover_row){
					Y.one('#i'+anchor).addClass('left');
				}
				Y.one('#i'+i).addClass('right');
				anchor = i+1;
				img_width_sum = 0;
				row+=1;
			}
		}
			total_row = row-1;/**check  if unhide exist after append**/
			//arrange the images that are not enough to form a row
				row_start[row] = anchor;
				row_end[row] = img_count;
				for(var i=anchor;i<=img_count;i++){
					if(i==anchor && null !== Y.one('#i'+i) && row>cover_row){
						Y.one('#i'+i).addClass('left');
					}
					if(null !== Y.one('#i'+i)){
						Y.one('#i'+i).addClass('row'+row);
						Y.one('#i'+i).addClass('unhide');
						total_row = row;/**check  if unhide exist after append**/
					}
				}
			return total_row;
	}
	function arrangeImg(y,start_row,total_row){		 
		var viewportHeight_ = Y.one('body').get('winHeight');
		

		for(var i=start_row;i<=total_row;i++){		 
			if(i<=cover_row){	 
				x = margin_left+cover_width+padding;	 
			}else{		 
				x = margin_left+padding;	 
			}	 
			for(var j=row_start[i];j<=row_end[i];j++){		 
					display_img_width[j] = Math.ceil(ini_img_width[j]*row_scale[i]);
					display_img_height[j] = row_height[i];
					img_diff[j] = Math.round((adj_img_width[j]-ini_img_width[j]*row_scale[i])*0.5);

					if(null!== Y.one('#i'+j) && Y.one('#i'+j).hasClass('add')){
						Y.one('#i'+j).removeClass('add');
					}
					if(null !== Y.one('#i'+j) && img_count != 0 ){
						Y.one('#i'+j).setStyles({	 
							'opacity':'1',		 
							'left':x,	 
							'top':y,	 
							'width':adj_img_width[j]+'px',		 
							'height':display_img_height[j]+'px'
						});	 
						Y.one('#i'+j).one('img').setStyles({
							'height':display_img_height[j] + 'px',
							'width':display_img_width[j]+'px',
							'left':img_diff[j]+'px'						
						});	 
						Y.one('#i'+j).one('p').setStyles({		 
							'width':display_img_width[j]+'px',
	                        'border':'#fff solid 7px',
	                        'left':img_diff[j]+'px'
						});	 
						if(Y.one('#i'+j).one('p').hasClass('type_video') && !Y.one('#i'+j).one('p').one('img') ){	 
							Y.one('#i'+j).one('.type_video').prepend('<img src="http://pic.wretch.cc/e/serv/album/img/cam30.png" />');		 
						}
					}else if(null === Y.one('#i'+j) && null !== Y.one('.montage') && null !== Y.one('#cover').one('a').getAttribute('href')){
						window.location.reload();	
					}
				var row_height_ = row_height[i];	
				img_x[j] = x;	 
				x += adj_img_width[j];		 
			}	 
			img_y[j] = y;

			if(null !== Y.one('.montage') && null !== Y.one('#cover') && i==total_row){
				if(!row_height[i]){
					row_height[i] = row_height_;
				}
				if(i<=2){
					/**handling the case  which pics not enough to fill the two former rows**/
					y = kukubar_height + margin_top +cover_height;
					Y.one('#endSpace').setStyles({
						'display':'block',
						'top':y + 'px',
						'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
					});
                    /*adjust hugewrapper height*/
					if( (y + ENDSPACE_HEIGHT - margin_top) < viewportHeight_){
						Y.one('#hugewrapper .container').setStyles({
							'height':viewportHeight_ + 'px',
							'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
						});
					}else{
						Y.one('#hugewrapper .container').setStyles({
							'height': (y + ENDSPACE_HEIGHT - margin_top) + 'px',
							'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
						});
					}

					/**The End of handling the case  which
					 ** pics not enough to fill the two former rows**/

				}else{
					Y.one('#endSpace').setStyles({
						'display':'block',
						'top':y + row_height[i]+border+'px',
						'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
					});
					/* adjust hugewrapper height*/

					if( (y + row_height[i] + border + ENDSPACE_HEIGHT - margin_top) < viewportHeight_){
						Y.one('#hugewrapper .container').setStyles({
							'height':viewportHeight_ + 'px',
							'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
						});
					}else{
						Y.one('#hugewrapper .container').setStyles({
							'height': (y + row_height[i] + border + ENDSPACE_HEIGHT - margin_top) + 'px',
							'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
						});
					}

				}
					
			}		
			y += row_height[i]+border;

		}
		Y.all('.montage').slice(-1).addClass('bc');
		if(null !== Y.one('#cover')){
			Y.one('#cover').setStyles({
				'opacity':'1',
				'filter':'progid:DXImageTransform.Microsoft.Alpha(opacity=100)',
				'left':margin_left+cover_width_adj+'px',
				'top':kukubar_height + margin_top+'px' 
			});
		}
	
		Y.later(100,Y,function (){

			if(null !== Y.one('.bc')){
				Y.one('.bc').detachAll();
				Y.one('.bc').once('beacon:reached',function(){
					ajaxRequest(Y.one('#owner_id').get('value'),Y.one('#book_id').get('value'),page,Y.all('.montage').size()+1,Y.one('#wretch-crumb').get('value'));
					page+=1;
				});
			}else{
				/**handle the case with only a picture in the album**/
				if(img_count == 0 && Y.one('#cover') !== null){
					Y.one('#cover').setStyles({
						'opacity':'1',
						'filter':'progid:DXImageTransform.Microsoft.Alpha(opacity=100)',
						'left':margin_left+cover_width_adj+'px',
						'top':kukubar_height + margin_top+'px'
					});
					Y.one('#endSpace').setContent('看完這本相簿囉!!');
					Y.one('#endSpace').setStyles({
						'display':'block',
						'top':kukubar_height + margin_top + cover_height + 'px',
						'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
					});
                   /* adjust hugewrapper height*/
					if((kukubar_height + margin_top + cover_height + ENDSPACE_HEIGHT - margin_top) >= viewportHeight_){
						Y.one('#hugewrapper .container').setStyles({
							'height':(kukubar_height + margin_top + cover_height + ENDSPACE_HEIGHT - margin_top) + 'px',
							'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
						});
					}else{
						Y.one('#hugewrapper .container').setStyles({
							'height': viewportHeight_ + 'px',
							'width':parseInt(Y.one('#kukubar-upper').getComputedStyle('width'), 10)+'px'
						});
					}


				}
				/**The End of handle the case with only a picture in the album**/

			}
		});
	}
	var myDataSource = new Y.DataSource.IO({
		source: "/ajax/album/ajax_display_get_photos.php?"
	});
	function ajaxRequest(user_id,book_id,page,img_index,wretch_crumb){
	
		myDataSource.sendRequest({
			request: "i="+user_id+"&b="+book_id+"&p="+page+"&style=angel"+wretch_crumb,
			callback: {
				success: function (e) {
							 try {
								 var data = Y.JSON.parse(e.response.results[0].responseText);
							 }
							 catch (e) {
								 alert("JSON Parse failed!");
								 return;
							 }

							 if(data.total){
								 var row_start = total_row,
									 start_index = Y.all('.montage').size()+1,
									 count = data.total,
									 n=0;
								 if(null !== Y.one('.unhide')){
									var unhide_before_append = Y.all('.unhide').size();
								 }else{
									var unhide_before_append = 0;
								 }
								 var img_index_ = 0;
								 for(var i=start_index;i<count+start_index;i++){
									 appendImg(data.result[img_index_].source_url,data.result[img_index_].source_url_large,data.result[img_index_].url,data.result[img_index_].title,data.result[img_index_].content_type,i);
									 if(null !== Y.one('#i'+i)){
										 Y.one('#i'+i).one('img').once('load',function(){
											 this.ancestor('.montage').setAttribute('iniWidth',parseInt(this.getComputedStyle('width'), 10) || 0);
											 ++n;
											 if(n==count){
												 startRender(start_index,row_start,count,unhide_before_append);
											 }
										 });
										 ++img_index_;
									 }
								 }				
								 Y.one("#endSpace").setContent("LOADING...");																													
							 }else{
								if(data.message=='END'){
									Y.one("#endSpace").setContent("看完這本相簿囉!");
									if(null !== Y.one('.bc')){
										Y.one('.bc').detachAll();
										Y.one('.bc').removeClass('bc');
									}
									for(var i=1;i <= Y.all('.montage').size();i++){
										if(null !== Y.all('.montage').item(i)){
											if(Y.all('.montage').item(i).one('img').getAttribute('src') != Y.all('.montage').item(i).one('img').getAttribute('src2')){
												Y.all('.montage').item(i).one('img').set('src',Y.all('.montage').item(i).one('img').getAttribute('src2'));
											}
										}
									}

								}

							 }
						 },
			    failure: function (e) {
					ajaxRequest(Y.one('#owner_id').get('value'),Y.one('#book_id').get('value'),page,Y.all('.montage').size()+1,Y.one('#wretch-crumb').get('value'));  
				}
		    }
		});
			
	}
	function startRender(start_index,start_row,count,unhide_before_append){
		var y_ = kukubar_height + margin_top;
		
		if(foldGroup ==null) var foldGroup = new Y.ImgLoadGroup({ name: 'fold group', foldDistance: 25 });
		for(var i=start_index;i<start_index+count;i++){
			if(null !== Y.one('#i'+i)){
				ini_img_width[i] = parseInt(Y.one('#i'+i).getAttribute('iniWidth'), 10) || 90;
			}		
		}
		/**handling the case that bcs are not removed properly**/
		if(Y.all('.bc').size()>1){
			for(var j=0;j<Y.all('.bc').size()-1;j++){
				Y.all('.bc').item(j).removeClass('bc');
			}
		}else{
			Y.all('.bc').removeClass('bc');
		}
		/**The End of handling the case that bcs are not removed properly**/

		if(unhide_before_append){
			start_index -= unhide_before_append;
		    adjIniWidth(start_index,Y.all('.montage').size());
			var total_row = adjustImg(0,start_index,Y.all('.montage').size(),start_row,win_size-cover_width);

			Y.all('.row'+start_row).removeClass('unhide');
			
		}else{
			
			/** correcting start_index**/
			 count = count + start_index - 1; 
			 adjIniWidth(start_index,count);
			 var total_row = adjustImg(0,start_index,count,start_row,win_size-cover_width);
			 start_row += 1;/* adjusting the start row of arrangingImg*/
		}
		for(var i=1;i< start_row;i++){
			y_ += row_height[i] + border;
		}
		arrangeImg(y_,start_row,total_row);
		
		if(null !== Y.one('.unhide')){start_index-=Y.all('.unhide').size();}/**check if unhide exisit after append**/
		for(var i=start_index;i<start_index+count+Y.all('.unhide').size();i++){
			if(null !== Y.one('#loader'+i)){
				foldGroup.registerImage({ domId: 'loader'+i, srcUrl:Y.one('#loader'+i).getAttribute('src2') });
			}
		}
	}
	function appendImg(source_url,source_url_large,url,title,type,div_id){
		if(null === Y.one('#i'+div_id)){
			var item = Y.Node.create('<div id="i'+div_id+'" class="add montage" style="opacity:0;height:'+ini_img_height+'px;"><a href="'+url+'" target="_blank"><img id="loader'+div_id+'"src="'+source_url+'"src2="'+source_url_large+'"style="height:'+ini_img_height+'px;" border="0"/></a><p class="'+type+'"><span></span></p></div>');
			Y.one('.montage').ancestor('td').append(item);
			Y.one('#i'+div_id).one('p').one('span').setContent(title);
		}
	}
});      

