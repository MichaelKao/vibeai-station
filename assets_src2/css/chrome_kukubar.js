/*jslint undef: false, sloppy: true, maxerr: 50, indent: 4 *//*global YUI*/
YUI().use('node', 'node-event-simulate', 'io', 'event-hover', 'json', function (Y) {
    if (! Y.one('#static-path')) {
        return;
    }

    Y.namespace('wretch');
    
    var W = Y.wretch;
    var buttons,
        bigcontainer,
        dropdowns,
        ajaxUrl = 'http:\/\/www.wretch.cc\/ajax\/common\/',
        ajaxFeatuedTopicUrl = ajaxUrl + 'ajax_featured_topic_subscription.php',
        staticPath,
        subscribePanel,
        loadingIcon,
        savedIcon,
        loadingMsg = '<span class="loading-msg">載入中</span>',
        loadingSaving = '<span class="loading-msg">正在儲存設定</span>',
        mask = Y.Node.create('<div id="scrb-panel-mask"></div>'),
        crumb,
        bLogin,
        bRequestAborted = false,
        nowBtn = Y.Node.create('<div></div>'),
        loginBtn,
        
        clearScroll,
        scrollup,
        nodeInfozone,
        handleSetInterval,
        
        // Text-based carousel module START
        START_DELAY = 500,  // Initial delay setting
        SPEED = 150,        // Carousel speed
        STOP_DELAY = 1000,  // Carousel freezed setting              
        CAROUSEL,
        firstNode,
        copyNode,
        ITEMHEIGHT,
        STEP,
        offset = 0,
        scrollingTimer,               
            
        handleCarouselAnimation = function () {
            offset += STEP;
            firstNode.setStyle('marginTop', -offset);
            if (offset === ITEMHEIGHT) {
                offset = 0;
                scrollingTimer.cancel();
                CAROUSEL.append(copyNode);
                firstNode.remove();
                firstNode = CAROUSEL.one('li');
                copyNode = firstNode.cloneNode(true);
                scrollingTimer = Y.later(STOP_DELAY, this, handleCarouselScrolling, null, false);               
            }
        },
            
        handleCarouselScrolling = function () {
            scrollingTimer = Y.later(SPEED, this, handleCarouselAnimation, null, true);    
        },
            
        startTextCarousel = function () {
            Y.later(START_DELAY, this, handleCarouselScrolling, null, false);
        },
        
        handleCarouselMouseEnter = function () {
            scrollingTimer.cancel();
        },
        
        handleCarouselMouseLeave = function () {
            scrollingTimer = Y.later(STOP_DELAY, this, handleCarouselScrolling, null, false);    
        },
        // Text-based carousel module END
        
        /*hover effect*/
        handleHover = function (e) {
            this.toggleClass('hover-on');
        },
        /*click effect*/
        handleClick = function (e) {
            this.toggleClass('selected');
        },
        /*handle footer on/off*/
        handleFooterOnOff = function (statusType) {
            var bOn = 1,
                uri,
                request;    
            if (statusType === 'on') {
                Y.one('#kukubar-lower').removeClass('hidden-footer');
            } else {
                Y.one('#kukubar-lower').addClass('hidden-footer');
                bOn = 0;
            }
            uri = ajaxUrl + 'ajax_persistent_footer_setting.php?display=' + bOn + crumb;
            request = Y.io(uri);
        },
        /*handle btn class*/
        setBtn = function (eT, statusType) {
            if (statusType === 'add') {
                setTimeout(function () {
                    eT.addClass('expanded-btn');
                }, 1);
            } else {
                setTimeout(function () {
                    eT.removeClass('expanded-btn');
                }, 1);
            }
        },
        /*reset all menu*/
        closeAllMenu = function (btn, eT) {
            bigcontainer.setStyle('zIndex', '0');
            if (Y.UA.ie === 6) {
                Y.all('select').setStyle('visibility', 'visible');
            }
            bRequestAborted = true;
            if (bLogin && Y.one('#footer-subscription').hasClass('expanded-btn')) {
                subscribePanel.one('.heading').remove(true);
                subscribePanel.one('.hd').set('innerHTML', '');
                subscribePanel.one('.bd').set('innerHTML', '');
            }
            //Y.one('.expanded-btn').removeClass('expanded-btn');
            Y.all('div.expanded').removeClass('expanded');    
            Y.all('.expanded-btn').removeClass('expanded-btn');    
            Y.all('#kukubar-lower ul.expanded').removeClass('expanded');    
            Y.all('iframe.expanded').removeClass('expanded');    
        },
        /*open targeted menu*/
        openMenu = function (eT) {
            var dd = eT.one('.dropdown');
            if (dd) {
                dd.addClass('expanded');
            } else {
                dd = eT.one('iframe');
                if (!dd) {
                    return;
                }
                dd.addClass('expanded');
            }
            bigcontainer.setStyle('zIndex', '0');
            if (Y.UA.ie === 6) {
                Y.one('#scrb-panel').setStyle('overflow', 'hidden');
                Y.all('select').setStyle('visibility', 'hidden');
            }
            buttons.removeClass('expanded-btn');
        },
        /*get notification*/
        getList = function (uri, eT) {
            var request,
                cfg,
                list = eT.one('ul'),
                onComplete = function (id, o, args) {
                    if (bRequestAborted) {
                        return;
                    }
                    list.set('innerHTML', o.responseText);
                };
            cfg = {
                method: 'GET',
                timeout: 3000,
                data: crumb, 
                on : {
                    complete: onComplete
                }            
            };
            list.setContent(loadingIcon + loadingMsg);
            request = Y.io(ajaxUrl + uri, cfg);
        },
        /*get full list when user has not subscribe anything*/
        getSubscriptionTopicList = function (statusType) {    
            var request,
                topicList,
                listMarkup = '',
                uri = ajaxFeatuedTopicUrl,
                hd = subscribePanel.one('.hd'),
                listSub = Y.one('#scrb-panel .hd ul.sub-list') || Y.Node.create('<ul class="sub-list"></ul>'),
                listUn = Y.Node.create('<ul class="unsub-list hidden"></ul>'),
                btn = Y.Node.create('<div><button class="footer-ok-btn deactivated">我要訂閱</button></div>'),
                listType,
                headerNotice = Y.one('#scrb-panel .heading') || Y.Node.create('<div class="heading"><div>'),
                onComplete,
                cfg;
            
            if (statusType === 'after') {
                headerNotice.set('innerHTML', '<h5>最新分類好文</h5>');
                onComplete = function (id, o, args) {
                    if (bRequestAborted) {
                        return;
                    }
                    var alreadySubscribed = [],
                        subscribeMoreBtn = Y.Node.create('<a class="add-sub" href="#">訂閱更多分類</a>'),
                        listWrap = Y.Node.create('<div class="add-more"><h6>訂閱其他分類</h6></div>'),
                        D =  Y.JSON.parse(o.responseText).result,
                        i;
                    
                    topicList = D.subscription;
    
                    for (i in topicList) {
                        if (topicList[i].topic_subscribed === 1) {
                            alreadySubscribed.push(topicList[i]);
                        }
                    }
    
                    listSub.set('innerHTML', makeSubscribeList(topicList, 'after'));
                    listSub.one('li').addClass('selected');    
                    listUn.set('innerHTML', makeUnsubscribeList(topicList));
                    listWrap.append(subscribeMoreBtn);
                    listWrap.append(listUn);
                    hd.append(listWrap);
                    getArticles(alreadySubscribed[0].topic_slug, D.current_topic, D.current_articles);
                    if (!!Y.one('#scrb-panel')) {
                        Y.one('#scrb-panel').setStyle('height', '');
                    }
                };
                listType = 'subscribed_list';
            } else {
                headerNotice.set('innerHTML', '<h5>選擇你有興趣的分類，無名將每天提供你最新的優質內容！</div>');
                onComplete = function (id, o, args) {
                    if (bRequestAborted) {
                        return;
                    }
    
                    var D =  Y.JSON.parse(o.responseText).result;
                    topicList = D.subscription;
    
                    listSub.set('innerHTML', makeSubscribeList(topicList, 'before'));
                    listSub.insert(btn, 'after');
                    getArticles(D.current_topic, D.current_topic, D.current_articles);
        
                };
                listType = 'list';
            }
    
            headerNotice.append('<span class="close-panel">關閉</span>');
            hd.set('innerHTML', '');
            hd.insert(headerNotice, 'before');
            hd.append(listSub);
            listSub.setContent(loadingIcon + loadingMsg);
            cfg = {
                method: 'GET',
                timeout: 3000,
                data: 'type=' + listType  + crumb, 
                on : {
                    complete: onComplete
                }            
            };
            request = Y.io(uri, cfg);
        },
        /*handle JSON to list*/
        makeSubscribeList = function (topicList, statusType, target) {
            //if (topicList.length) {}
            var listMarkup = '',
                on = '',
                i;
            for (i in topicList) {
                if (statusType === 'after' && topicList[i].topic_subscribed === 0) {
                } else {
                    if (target === i) { 
                        on = 'selected';
                    }
                    if (topicList[i].topic_slug !== undefined) { 
                        listMarkup += '<li class="topic ' + on + '" data-content="' + topicList[i].topic_slug + '" data-order="' + i + '">' +
                                    '<span class="add">+</span>' +
                                    '<span class="del">-</span>' +
                                    topicList[i].topic_name +
                                '</li>';
                        on = '';
                    }
                }
            }
            return listMarkup;
        },
        /*hand JSON to list*/
        makeUnsubscribeList = function (topicList) {
            var listMarkup = '',
                meter = 0,
                i;
            for (i in topicList) {
                if (topicList[i].topic_slug !== undefined) { 
                    if (topicList[i].topic_subscribed === 0) {
                        meter += 1;
                        listMarkup +=  '<li class="topic unsub" data-content="' + topicList[i].topic_slug + '" data-order="' + i + '">' + 
                                        '<span class="add">+</span>' +
                                        topicList[i].topic_name + 
                                        '</li>';
                    }
                }
            }
            if (meter === topicList.length) {
                getSubscriptionTopicList();
                maskMsg('closed');
                setTimeout(function () {
                    subscribePanel.removeClass('after-subscribe');
                }, 100);
            } else if (meter === 0) {
                subscribeMoreHandler('off');
            } else {
                subscribeMoreHandler('on');
                setTimeout(function () {
                    try {
                        if (Y.one('#scrb-panel .hd ul.sub-list li')) {
                            /*click next topic*/
                            //Y.one('#scrb-panel .hd ul.sub-list li').simulate('click');
                        }
                    } catch (e) {
                        window.alert(e);
                    }
                }, 1);
            }
            return listMarkup;
        },
        
        subscribeMoreHandler = function (statusType) {
            setTimeout(function () {
                var addMoreList = Y.one('#scrb-panel .hd .add-more');
                if (statusType === 'off') {
                    addMoreList.addClass('hidden-list');
                } else {
                    addMoreList.removeClass('hidden-list');
                }
            }, 1);
        },
        
        /*get random articles when user has not subscribe anything*/
        getArticles = function (contentType, currentType, articles) {
            var request,
                cfg,
                listMarkup = '',
                type,
                unsubscribeBtn = Y.Node.create('<a class="unsub" href="#">取消訂閱這個分類</a>'),
                uri = ajaxFeatuedTopicUrl,
                displayArticles = function (articleList) {
                    for (var i in articleList) {
                        if (articleList[i].article_url !== undefined) {
                            listMarkup += '<li class="article-item" _href="' + articleList[i].article_url + '">' +
                                '<span class="article-type">' + articleList[i].topic_name + '</span>' +
                                '<span class="author-thumb"><a class="bar-link" href="' + articleList[i].author_url + '">' +
                                '<img src="' + articleList[i].author_cover_url + '">' +
                                '</a></span>' +
                                '<div class="article-list-right">' +
                                '<h6><a class="bar-link" href="' + articleList[i].article_url + '">' +
                                articleList[i].article_title +
                                '</a></h6>' +
                                '<span class="author"><a href="' + articleList[i].author_url + '">' +
                                articleList[i].author_nickname +
                                '</a></span>' +
                                '</div>' +
                                '<span class="article-time">' + articleList[i].article_posted_at + '</span>' +
                                '</li>';
                        }
                    }
                    if (contentType !== undefined) {
                        subscribePanel.one('.bd').set('innerHTML', '<ul class="article-list">' + listMarkup + '</ul>'); 
                        if (contentType !== '') {
                            subscribePanel.one('.bd').append(unsubscribeBtn);
                            unsubscribeBtn.setAttribute('data-content', contentType);
                        }
                        setTimeout(function () {
                            if (subscribePanel.hasClass('after-subscribe')) {
                                Y.one('#kukubar-lower div#scrb-panel.after-subscribe').setStyle('backgroundColor', '#F9F9F9');
                            }
                        }, 1);
                    } else {
                        subscribePanel.one('.bd').set('innerHTML', '<h5><em>精選文章</em></h5><ul>' + listMarkup + '</ul>');
                    }                   
                };
    
            if (contentType !== currentType) {
                type = 'type=article&topic=' + contentType;
                cfg = {
                    method: 'GET',
                    timeout: 3000,
                    data: type + crumb, 
                    on : {
                        complete: function (id, o, args) {
                            if (bRequestAborted) {
                                return;
                            }
                            displayArticles(Y.JSON.parse(o.responseText).result.current_articles);
                        }            
                    }
                };
                //subscribePanel.one('.bd').set('innerHTML', loadingIcon+loadingMsg);
                request = Y.io(uri, cfg);
            }
            else {
                displayArticles(articles);
            }
        },
        /*make a request for subscription*/
        subscribeList = function (contentType, actionType, contentOrder) {
            var request,
                cfg,
                topicList,
                msg,
                uri = ajaxFeatuedTopicUrl,
                onComplete = function (id, o, args) {
                    var D, lists;
                    subscribePanel.removeClass('panel-loading');
                    if (bRequestAborted) {
                        return;
                    }
                    try {
                        D = Y.JSON.parse(o.responseText).result;
                        topicList = D.subscription;
                        if (!subscribePanel.hasClass('after-subscribe')) {
                            subscribePanel.one('.hd').set('innerHTML', '<ul class="sub-list">' + makeSubscribeList(topicList, 'before') + '</ul>');
                            subscribePanel.addClass('after-subscribe');
                            getSubscriptionTopicList('after');
                        } else {
                            lists =  subscribePanel.all('.hd ul');
                            setTimeout(function () {
                                lists.item(0).set('innerHTML', makeSubscribeList(topicList, 'after', contentOrder));
                                lists.item(1).set('innerHTML', makeUnsubscribeList(topicList));
                            }, 100);
                            if (actionType === 'subscribe') {
                                getArticles(contentType, D.current_topic, D.current_articles);
                            } else if (actionType === 'unsubscribe') {
                                setTimeout(function () {
                                    var first = Y.one('#scrb-panel .hd ul.sub-list li');
                                    first.addClass('selected'); 
                                }, 1000);
                                getArticles(D.current_topic, D.current_topic, D.current_articles);
                            }
                        }
                        setTimeout(function () {    
                            msg.remove(true);
                            maskMsg('saved');
                        }, 100);
                    } catch (e) {
                        window.alert('喔喔！系統出現錯誤，請稍後再試！');
                        msg.remove(true);
                        maskMsg('error');
                    }
                },
                onStart = function (id, o, args) {
                    msg = maskMsg('saving');
                    subscribePanel.addClass('panel-loading');
                },
                onError = function (id, o, args) {
                    window.alert('喔喔！系統出現錯誤，請稍後再試！');
                };

            cfg = {
                method: 'GET',
                timeout: 3000,
                data: 'type=' + actionType + '&topic=' + contentType + crumb, 
                on : {
                    complete: onComplete,
                    start: onStart,
                    error: onError
                }            
            };
            request = Y.io(uri, cfg);    
        },
        
        /*for request sending*/
        maskMsg = function (actionType) {
            var maskHeight = subscribePanel.getComputedStyle('height'),
                msg = Y.Node.create('<div></div>');
            switch (actionType) {    
            case 'saving':
                msg.setContent('<div class="msg-saving msg-block"><span>' + loadingIcon + '</span><span>正在儲存設定</span></div>');
                mask.append(msg);
                mask.setStyle('height', maskHeight);
                break;
            case 'saved':
                msg.setContent('<div class="msg-saved msg-block"><span>' + savedIcon + '</span><span>設定已儲存</span></div>');
                mask.append(msg);
                setTimeout(function () {
                    maskMsg('close');
                }, 10);
                break;
            case 'error':
            case 'close':
                setTimeout(function () {
                    mask.setStyle('height', '0px');    
                    mask.set('innerHTML', '');
                }, 100);
            }
            return msg;
        },
        
        /*handle topic subscription*/
        subscribeHandler = function () {
            if (subscribePanel.hasClass('after-subscribe')) {
                getSubscriptionTopicList('after');
            } else {
                getSubscriptionTopicList();
            }
        },
        
        /*progressively enhance search input field*/
        enhanceSearch = function (id) {
            if (!Y.one(id)) {
                return;
            } 
            var mod = Y.one(id),
                labels = mod.all('label'),
                legend = mod.one('legend'),
                list = mod.one('.service-list'),
                inputs = mod.all('input[type=radio]'),
                query = mod.one('#wretch-search-text');
        
            query.set('value', query.get('title'));        
            
            inputs.addClass('hidden');
            
            inputs.each(function () {
                var inputClone;
                if (this.getAttribute('data') === 'checked') {
                    this.simulate('click');
                    this.next().addClass('on');
                    if (Y.UA.ie <= 8) {
                        inputClone = Y.Node.create('<input type="radio" name="' + this.get('name') + '" id="' + this.get('id') + '" value="' + this.get('value') + '" checked="checked" class="hidden">');
                        this.insert(inputClone, 'after');
                        inputClone.simulate('click');
                        this.get('parentNode').removeChild(this);
                    }    
                }
                if (Y.UA.ie < 9 && Y.UA.ie > 0) {
                    if (this.getAttribute('value') === 'video' && this.getAttribute('data') !== 'checked') {
                        inputClone = Y.Node.create('<input type="radio" name="type" id="' + this.get('id') + '" value="' + this.get('value') + '" class="hidden">');
                        this.insert(inputClone, 'after');
                        this.get('parentNode').removeChild(this);
                    }
                }
            });
            
            legend.on('click', function (e) {
                closeAllMenu();
                e.halt();
                if (!list.hasClass('expanded')) {
                    if (Y.UA.ie === 6) {
                        Y.all('select').setStyle('visibility', 'hidden');
                    }
                }
                setTimeout(function () {
                    bigcontainer.setStyle('zIndex', '0');
                    list.toggleClass('expanded');
                }, 1);
            });
            
            /*fix IE input change event*/
            /*    
            if (Y.UA.ie > 0) {
            */
            labels.on('click', function (e) {
                if (Y.UA.ie === 6) {
                    Y.all('select').setStyle('visibility', 'visible');
                }
                this.removeClass('on');
                e.target.addClass('on');
                legend.setContent(e.currentTarget.get('innerHTML') + '<span>選擇服務</span>');
                Y.one('#' + e.currentTarget.getAttribute('for')).set('checked', true);
                if (query.get('value') === '' || query.get('value') === query.getAttribute('title')) {
                    query.set('title', e.currentTarget.getAttribute('_target'));
                    query.set('value', query.getAttribute('title'));
                } else {
                    query.set('title', e.currentTarget.getAttribute('_target'));
                }
            });
            /*    
            }
            */
            /*
            inputs.on('', function (e) {
                if (Y.UA.ie === 6) {
                    Y.all('select').setStyle('visibility', 'visible');
                }
                e.label = e.target.next();
                labels.removeClass('on');
                e.label.addClass('on');
                list.removeClass('expanded');
                legend.setContent(e.label.get('innerHTML') + '<span>選擇服務</span>');
                if (query.get('value')===''||query.get('value')===query.getAttribute('title')) {
                    query.set('title', '搜尋'+ e.label.getAttribute('_target')+'關鍵字');
                    query.set('value', query.getAttribute('title'));
                } else {
                    query.set('title', '搜尋'+ e.label.getAttribute('_target')+'關鍵字');
                }
            });
            */
        },
        
        checkNewVitality = function () {
            if (!Y.one('#footer-vitality')) {
                return;
            }
            var request,
                uri = '/ajax/common/ajax_has_new_vitality.php',
                onComplete,
                cfg;
            onComplete = function (id, o, args) {
                var oJSON = Y.JSON.parse(o.responseText);
                if (oJSON.result === 'true' || oJSON.result === true) {
                    Y.one('#footer-vitality').addClass('new-msg');
                }
            };
            cfg = {
                method: 'GET',
                data: 'crumb=' + crumb,
                on: {
                    complete: onComplete
                }
            };
            request = Y.io(uri, cfg);
        },
        
        requestToLogIn = function (e) {
            var eT = e.currentTarget;
            if (eT.get('id') === 'footer-vitality') {
                loginBtn.addClass('vitality');
                loginBtn.removeClass('subscription');
            } else {
                loginBtn.removeClass('vitality');
                loginBtn.addClass('subscription');
            }
            if (eT.hasClass('expanded-btn')) {
                e.currentTarget.removeClass('expanded-btn');
                loginBtn.removeClass('expanded');
            } else {
                e.currentTarget.addClass('expanded-btn');
                loginBtn.addClass('expanded');
                loginBtn.setX(e.currentTarget.getX());
            }
        },
        
        fixIE6Position = function () {
            var footer = Y.one('#kukubar-lower'),
                footerSwitch = Y.one('#footer-switch'),
                currentHeight,
                fixFooter; 
            
            fixFooter = function () {
                footer.addClass('hidden-footer-ie');
                setTimeout(function () {
                    currentHeight = footer.get('docScrollY') + footer.get('winHeight') - 22;
                    footer.setY(currentHeight);
                    footerSwitch.setY(currentHeight);
                    footer.removeClass('hidden-footer-ie');
                    //footer.setStyle('display', 'block');
                }, 1);
    
            };
            Y.on('scroll', function () {
                fixFooter();
            });
            Y.on('resize', function () {
                fixFooter();
            });
        },
        
        init = function () {
            crumb = Y.one('#wretch-crumb').get('value');
            buttons.on('click', function (e) {
                /*handle links*/
                var eT = e.currentTarget;
                if (e.target.hasClass('bar-link')) { 
                    e.halt();
                    location.href = e.target.get('href');
                    return;
                }
                else if (e.target.getAttribute('__href')) { 
                    e.halt();
                    location.href = e.target.getAttribute('__href');
                    return;
                } else if (e.target.getAttribute('_href')) { 
                    location.href = e.target.getAttribute('_href');
                    return;
                } else if (e.target.hasClass('content') || e.target.hasClass('contentp')) { 
                    location.href = e.target.ancestor('li').getAttribute('_href');
                    return;
                } else if (e.target.get('tagName').toLowerCase() === 'img') {
                    var link = e.target.ancestor('a');
                    if (link) {
                        location.href = link.getAttribute('href');
                    }
                }
                /*handle btns*/
                if (eT.get('id') === 'wretch-notice') {
                    e.stopPropagation();
                    closeAllMenu();
                    bRequestAborted = false;
                    if (!eT.hasClass('updated') && !eT.hasClass('expanded-btn')) {
                        openMenu(eT);
                        setBtn(eT, 'add');
                        eT.addClass('updated');
                        getList('ajax_get_notifications.php', eT);
                    } else if (eT.hasClass('updated') && !eT.hasClass('expanded-btn')) {
                        openMenu(eT);
                        //eT.addClass('expanded-btn');
                        setBtn(eT, 'add');
                    } else if (eT.hasClass('expanded-btn')) {
                        setBtn(eT, 'remove');
                    }
                }
                else if (eT.get('id') === 'footer-vitality' || eT.get('id') === 'footer-subscription') {
                    e.halt();
                    var isExpanded = eT.hasClass('expanded-btn');
                    closeAllMenu();
                    if (bLogin) {
                        setTimeout(function () {
                            if (!isExpanded) {
                                bRequestAborted = false;
                                openMenu(eT);
                                setBtn(eT, 'add');
                                if (eT.get('id') === 'footer-vitality') {
                                    eT.removeClass('new-msg');
                                    getList('ajax_get_vitality_updates.php', eT);
                                } else {
                                    subscribeHandler();
                                }
                            } else {
                                setBtn(eT, 'remove');
                            }
                        }, 1);
                    } else {
                        requestToLogIn(e);
                    }
                }
                else if (eT.hasClass('expanded-btn')) {
                    e.halt();
                    closeAllMenu();
                    setBtn(eT, 'remove');
                } else {
                    e.halt();
                    closeAllMenu();
                    nowBtn = eT;
                    bRequestAborted = false;
                    openMenu(eT);
                    setBtn(eT, 'add');
                }
            });
            
            subscribePanel.delegate('click', function (e) {
                e.halt();
            }, '.panel-block');
            
            subscribePanel.delegate('click', function (e) {
                e.halt();
                if (subscribePanel.hasClass('after-subscribe')) {
                    if (!e.currentTarget.hasClass('selected') && !e.currentTarget.hasClass('unsub')) {
                        e.container.all('ul.sub-list li').removeClass('selected');
                        e.currentTarget.addClass('selected');
                        getArticles(e.currentTarget.getAttribute('data-content'));
                    } else if (e.currentTarget.hasClass('unsub')) {
                        subscribeList(e.currentTarget.getAttribute('data-content'), 'subscribe', e.currentTarget.getAttribute('data-order'));
                    }            
                } else {
                    e.currentTarget.toggleClass('selected');
                    setTimeout(function () {
                        if (subscribePanel.all('ul li.selected').size() > 0) {
                            subscribePanel.one('button.footer-ok-btn').removeClass('deactivated');
                        } else {
                            subscribePanel.one('button.footer-ok-btn').addClass('deactivated');
                        }
                    }, 100);
                }
            }, 'ul li.topic');
            
            subscribePanel.delegate('click', function (e) {
                e.halt();
                var aSub = [];
                subscribePanel.all('ul li.selected').each(function () {
                    aSub.push(this.getAttribute('data-content'));
                });
                
                if (aSub.length > 0) {
                    subscribeList(aSub.join(','), 'subscribe');
                } else {
                    alert('請選擇你有興趣的分類');
                }
            }, 'div button');
            
            subscribePanel.delegate('click', function (e) {
                e.halt();
                subscribeList(e.currentTarget.getAttribute('data-content'), 'unsubscribe');
            }, '.bd a.unsub');
            
            subscribePanel.delegate('click', function (e) {
                e.halt();
                setBtn(e.container.get('parentNode'), 'remove');
                closeAllMenu();
            }, 'span.close-panel');
            
            subscribePanel.delegate('click', function (e) {
                e.currentTarget.next().toggleClass('hidden');
                setTimeout(function () {
                    /*
                    var hH = parseInt(subscribePanel.one('.hd').getComputedStyle('height'), 10),
                        hB = parseInt(subscribePanel.one('.bd').getComputedStyle('height'), 10);
                        subscribePanel.one('.bd').setStyle('height', hH+ 20 + 'px');
                    */
                }, 101);
            }, 'a.add-sub');
            
            subscribePanel.delegate('click', function (e) {
                if (e.target.get('tagName').toLowerCase() === 'a') { 
                    location.href = e.target.getAttribute('href');
                } else if (e.target.get('tagName').toLowerCase() === 'img') {
                    e.halt();
                    var link = e.target.ancestor('a');
                    if (link) {
                        location.href = link.getAttribute('href');
                    }
                } else {
                    location.href = e.currentTarget.getAttribute('_href');
                }    
            }, 'li.article-item');
            
            Y.one('html').on('click', function (e) {
                closeAllMenu();
                Y.all('.expanded-btn').removeClass('expanded-btn');
            });
            Y.one('#wretch-search-text').on('focus', function (e) {
                if (this.get('title') === this.get('value')) {
                    this.set('value', '');
                }
            });
            Y.one('#wretch-search-text').on('blur', function (e) {
                if (this.get('value') === '') {
                    this.set('value', this.get('title'));
                    this.addClass('blur');
                }
            });
            Y.one('#footer-switch').on('click', function (e) {
                if (this.hasClass('off')) {
                    handleFooterOnOff('on');
                } else {
                    handleFooterOnOff('off');
                }
                this.toggleClass('off');
            });
            if (bLogin) {
                Y.one('#wretch-notice').delegate('hover', handleHover, handleHover, 'ul li');
                if (Y.one('#footer-vitality')) {
                    Y.one('#footer-vitality div.dropdown').delegate('hover', handleHover, handleHover, 'ul li');
                }
                subscribePanel.delegate('hover', handleHover, handleHover, 'ul li');
            } else {
                loginBtn = Y.one('#kukubar-lower .login-request');
            }
            enhanceSearch('#wretch-search');
            subscribePanel.append(mask);
            setTimeout(function () {
                checkNewVitality();
            }, 5000);
        };
        
    Y.on('domready', function () {
        buttons = Y.all('.bar-block-click');
        bigcontainer = Y.one('#bigcontainer') || Y.Node.create('<div></div>');
        subscribePanel = Y.one('#scrb-panel') || Y.Node.create('<div></div>');
        dropdowns = Y.all('.dropdown');
        bLogin = Y.one('input#login');
        staticPath = Y.one('#static-path').get('value');
        loadingIcon = '<img class="loading-icon" src="' + staticPath + 'img/ico_loading.gif">';
        savedIcon = '<img class="loading-icon" src="' + staticPath + 'img/ico_saved_msg.png">';
        // Text-based Carousel
        CAROUSEL = Y.one('#text-carousel ul');
        firstNode = CAROUSEL.one('li');
        copyNode = firstNode.cloneNode(true);
        ITEMHEIGHT = parseInt(firstNode.getStyle('lineHeight'), 10);
        STEP = ITEMHEIGHT / 10;
        
        if (!!CAROUSEL) {
            startTextCarousel();
        }        
        
        if (Y.one('#kukubar-upper') && Y.one('#kukubar-lower')) {
            init();
        } else {
            enhanceSearch('#wretch-search');
        }
        if (Y.UA.ie === 6) {
            fixIE6Position();
            Y.all('select').each(function () {
                if (this.get('name') === 'category') {
                    this.setStyle('display', 'none');
                }
            });
        }
    });
    
    scrollup = function (O, D, C) {
        if (D === C) {
            var cloneLi = O.one('li').cloneNode(true);
            O.one('li').remove();
            O.appendChild(cloneLi);
            cloneLi.setStyle('marginTop', '0px');
            O.one('li').setStyle('marginTop', '0px');
        } else {
            var firstLi = O.one('li'),
            step = 3,
            l;

            C = C + step;
            l = (C >= D ? C - D : 0);
            firstLi.setStyle('marginTop', (-C + l) + 'px');
            setTimeout(function () {
                scrollup(O, D, C - l);
            }, 100);
        }
    };
    // Text-based Carousel START
    Y.one('#text-carousel').on('mouseenter', handleCarouselMouseEnter);
    Y.one('#text-carousel').on('mouseleave', handleCarouselMouseLeave);
    // Text-based Carousel END
    
    nodeInfozone = Y.one('#infozone ul'); 
    
    handleSetInterval = function () {
        clearScroll = setInterval(function () {
            scrollup(nodeInfozone, 30, 0);
        }, 3000);
    };
    
    handleSetInterval();
    
    nodeInfozone.delegate('mouseover', function () {
        clearInterval(clearScroll);
    }, 'li');
    
    nodeInfozone.delegate('mouseout', function () {
        handleSetInterval();
    }, 'li');
    
});
