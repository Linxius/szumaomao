const config = require('../../../config.js');
const utils = require('../../../utils.js');
const shareTo = utils.shareTo;
const getCurrentPath = utils.getCurrentPath;
const getGlobalSettings = utils.getGlobalSettings;
const formatDate = utils.formatDate;

const user = require('../../../user.js');
const getCurUserInfoOrFalse = user.getCurUserInfoOrFalse;
const getUserInfo = user.getUserInfo;

const getAvatar = require('../../../cat.js').getAvatar

// 页面设置，从global读取
var page_settings = {};
var cat_id;

// 常用的对象
const db = wx.cloud.database();
const coll_comment = db.collection('comment');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    show_fix_header: false,
    cat: {},
    comments: [],
    comment_count: 0,
    keyboard_height: 0,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    cat_id = options.cat_id;
    // 开始加载页面
    const that = this;
    getGlobalSettings('detailCat').then(settings => {
      // 先把设置拿到
      page_settings = settings;
      // 启动加载
      that.loadCat();
      that.loadMoreComment();
    })

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    const cat = this.data.cat;
    const cat_name = cat.name;
    const cat_avatar = cat.avatar.photo_compressed || cat.avatar.photo_id;
    return {
      title: `${cat_name}的留言板 - 中大猫谱`,
      imageUrl: cat_avatar,
    }
  },

  onShareTimeline: function () {
    const cat = this.data.cat;
    const cat_name = cat.name;
    const cat_avatar = cat.avatar.photo_compressed || cat.avatar.photo_id;
    return {
      title: `${cat_name}的留言板 - 中大猫谱`,
      imageUrl: cat_avatar,
    }
  },

  bindCommentScroll(e) {
    const to_top = e.detail.scrollTop;
    const show_fix_header = this.data.show_fix_header;

    const should_show = to_top > 5? true: false;
    if (should_show != show_fix_header) {
      this.setData({
        show_fix_header: should_show
      });
    }
  },
  
  async loadCat() {
    const db = wx.cloud.database();
    var cat = (await db.collection('cat').doc(cat_id).get()).data;
    console.log(cat);
    
    // 获取头像
    cat.avatar = await getAvatar(cat._id, cat.photo_count_best);
    console.log(cat.avatar);
    this.setData({
      cat: cat
    });
  },

  commentFocus(e) {
    this.setData({
      keyboard_height: e.detail.height || 0
    })
  },

  commentBlur() {
    this.setData({
      keyboard_height: 0
    })
  },

  commentInput(e) {
    this.setData({
      comment_input: e.detail.value
    });
  },

  // 授权个人信息
  getUInfo() {
    const that = this;
    // 检查用户信息有没有拿到，如果有就更新this.data
    getCurUserInfoOrFalse().then(res => {
      if (!res) {
        console.log('未授权');
        return;
      }
      console.log(res);
      that.setData({
        isAuth: true,
        user: res,
      });
    });
  },

  // 发送留言
  sendComment() {
    const content = this.data.comment_input;

    // 空的就不用留言了
    if (!content || content.length == 1) {
      return false;
    }

    // 判断是否可以留言
    const user = this.data.user;
    if (user.cantComment) {
      wx.showModal({
        title: "无法留言",
        content: "如有误封请在\"关于-信息反馈\"中留言~",
        showCancel: false,
      })
      return false;
    }
    
    // 插入留言
    const that = this;
    var item = {
      content: content,
      user_openid: user.openid,
      create_date: new Date(),
      cat_id: cat_id,
    };
    wx.cloud.callFunction({
      // The name of the cloud function to be called
      name: 'commentCheck',
      // Parameter to be passed to the cloud function
      data: {
        content: content,
        nickname: user.userInfo.nickName,
      },
      success: function(res) {
        console.log(res);

        // 检测接口的返回
        res = res.result;
        console.log(res);
        if (res.errCode != 0 || res.result.suggest != "pass") {
          // 内容检测未通过
          const label_type = {
            100: "正常",
            10001: "广告",
            20001: "时政",
            20002: "色情",
            20003: "辱骂",
            20006: "违法犯罪",
            20008: "欺诈",
            20012: "低俗",
            20013: "版权",
            21000: "其他",
          }
          console.log(res.result.label);
          const label_code = res.result.label;
          const label = label_type[label_code];
          
          wx.showModal({
            title: "内容检测未通过",
            content: `涉及[${label_code}]${label}内容，请修改嗷~~`,
            showCancel: false,
          });
          return false;
        }
        // 检测通过
        that.addComment(item, user);
      },
      fail: err => {
        // handle error
        wx.showModal({
          title: "内容检测失败",
          content: "请开发者检查“commentCheck”云函数是否部署成功",
          showCancel: false,
        })
      },
    })
  },

  addComment(item, user) {
    const that = this;
    coll_comment.add({
      data: item,
      success: function(res) {
        // res 是一个对象，其中有 _id 字段标记刚创建的记录的 id
        console.log(res, user);
        
        // 插入最新留言 + 清空输入框
        console.log(item);
        item.userInfo = user.userInfo;
        item.datetime = formatDate(item.create_date, "yyyy-MM-dd hh:mm:ss")
        var comments = that.data.comments;
        comments.unshift(item);
        that.setData({
          comment_input: "",
          comments: comments,
        });

        // 显示success toast
        wx.showToast({
          title: '留言成功~',
        });
      },
      fail: function(res) {
        wx.showModal({
          title: "留言失败",
          content: "请开发者检查“comment”云数据库是否创建，权限是否设置为“双true”",
          showCancel: false,
        })
        console.error(res);
      }
    })
  },

  // 加载更多留言
  // TODO(zing): 支持排序方式修改
  async loadMoreComment() {
    const _ = db.command;
    var comments = this.data.comments;
    var qf = {
      deleted: _.neq(true),
      cat_id: cat_id
    };
    var res = await coll_comment.where(qf).orderBy("create_date", "desc")
                  .skip(comments.length).limit(10).get();

    for (var item of res.data) {
      const openid = item.user_openid;
      var res = await getUserInfo(openid);
      if (res) {
        item.userInfo = res.userInfo;
      }
      item.datetime = formatDate(item.create_date, "yyyy-MM-dd hh:mm:ss")
      comments.push(item);
    }

    this.setData({
      comments: comments
    });

  }

})