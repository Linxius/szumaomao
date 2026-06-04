// miniprogram/pages/info/contact/contact.js
import { text as text_cfg, contact_qr_weixin, contact_qr_xiaohongshu, contact_qr_douyin, contact_qr_official_weixin } from "../../../config";
import { signCosUrl } from "../../../utils/common";
const share_text = text_cfg.app_name + ' - 联系我们';
const qrMap = {
  official_weixin: contact_qr_official_weixin,
  weixin: contact_qr_weixin,
  xiaohongshu: contact_qr_xiaohongshu,
  douyin: contact_qr_douyin,
};
const app = getApp();
Page({

  data: {
    text_cfg: text_cfg,
  },

  onLoad: function (option) {

  },

  onShareAppMessage: function () {
    return {
      title: share_text
    }
  },

  async openImg(e) {
    const platform = e.currentTarget.dataset.platform;
    const src = await signCosUrl(qrMap[platform]);
    wx.previewImage({
      urls: [src],
      success: (res) => {
        console.log(res);
      },
      fail: (res) => {
        console.log(res);
      },
      complete: (res) => {
        console.log(res);
      },
    });
  },
})
