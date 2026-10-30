/* Only public introductory lessons and member lesson titles. Protected lesson bodies are in Supabase RLS table. */
window.NUMEROLOGY_CURRICULUM = {
  "version": "2026-10-30-member-access",
  "methodNote": "入門教材公開閱讀；其他教材需通過 Supabase 會員驗證才能取得。內容獨立於遊戲題庫及成績。",
  "sources": {
    "han": {
      "label": "《漢書》卷三十〈藝文志〉",
      "url": "https://ctext.org/han-shu/yi-wen-zhi",
      "type": "原始文獻"
    },
    "yi": {
      "label": "《周易》〈繫辭上〉",
      "url": "https://ctext.org/book-of-changes/xi-ci-shang",
      "type": "原始文獻"
    },
    "shi": {
      "label": "《史記》卷二十七〈天官書〉",
      "url": "https://zh.wikisource.org/zh/%E5%8F%B2%E8%A8%98/%E5%8D%B7027",
      "type": "原始文獻"
    },
    "suwen": {
      "label": "《黃帝內經》〈素問〉",
      "url": "https://ctext.org/huangdi-neijing/suwen",
      "type": "原始文獻"
    },
    "idp": {
      "label": "國際敦煌計畫：敦煌星圖 S.3326 館藏",
      "url": "https://idp.bl.uk/collection/7861395E5F814419BA05483EAB254832/",
      "type": "館藏資料"
    },
    "sinica": {
      "label": "中央研究院史語所：天文圖拓本館藏",
      "url": "https://museum.sinica.edu.tw/collection/5/item/387/",
      "type": "館藏資料"
    }
  },
  "topics": [
    {
      "id": "classification",
      "group": "研究入門",
      "title": "數術文獻與歷史分類",
      "lead": "理解古代書目如何分類知識，避免把現代的「數術」或「五術」視為跨時代不變的體系。",
      "points": [
        "《漢書·藝文志》區分六藝、諸子、詩賦、兵書、術數與方技等著錄類別。",
        "〈術數略〉列有天文、曆譜、五行、蓍龜、雜占、形法；〈方技略〉另列醫經、經方、房中、神仙。",
        "書目分類反映編纂者的知識秩序，不等於所有實際使用者都遵守同一學科界線。"
      ],
      "method": "比較〈術數略〉與〈方技略〉的分類邏輯，區分古代目錄用語與今日網站的教學欄目。",
      "caution": "「山醫命卜相」適合用作部分後世傳統的描述，不能直接當成《漢書》原有的五分法。",
      "question": "為何需要區分文獻分類、實際技術與後人重新整理的知識體系？",
      "sources": [
        "han"
      ],
      "track": "topics",
      "sort_order": 1,
      "access_tier": "intro"
    },
    {
      "id": "yinyang",
      "group": "基本概念",
      "title": "陰陽、五行與關聯思維",
      "lead": "從概念的文本語境出發，認識陰陽與五行如何成為組織自然、時間與社會現象的語言。",
      "points": [
        "陰陽可用於描述相對位置、變化與相互關係；不宜先驗地把它化約為固定的兩個物體。",
        "五行相關說法出現在不同類型的古代文獻中，彼此並非完全同義。",
        "分析古代技術時，應先辨認作者使用陰陽、五行所處理的具體問題。"
      ],
      "method": "對照《周易》〈繫辭〉的陰陽論述與《漢書》所著錄的五行書類，觀察不同文本層次。",
      "caution": "這是現代研究整理的概念引導，不主張所有時代共享同一套完整宇宙論。",
      "question": "同一術語進入易學、醫學與占候語境時，其功能可能有何差異？",
      "sources": [
        "yi",
        "han"
      ],
      "track": "topics",
      "sort_order": 2,
      "access_tier": "intro"
    },
    {
      "id": "calendar",
      "group": "基本概念",
      "title": "干支、曆譜與歲時",
      "lead": "認識時間標記、曆法安排與吉凶選擇術之間的關係及其差異。",
      "points": [
        "干支常被用來標記時間，應注意不同時代、地域及制度中的用法。",
        "曆譜涉及年月日的編排與推算，不等同於所有以日期判斷吉凶的活動。",
        "古代曆法知識與官方制度、農事、祭祀及占候實踐可能相互關聯。"
      ],
      "method": "以〈術數略〉的曆譜分類作為線索，先釐清曆法計算與占候詮釋的不同層面。",
      "caution": "本單元不宣稱存在跨朝代通用且固定不變的干支推算法。",
      "question": "曆日計算與擇日占候的研究材料應如何分辨？",
      "sources": [
        "han"
      ],
      "track": "topics",
      "sort_order": 3,
      "access_tier": "intro"
    },
    {
      "id": "stars",
      "group": "天文史",
      "title": "天文、星官與天象占候",
      "track": "topics",
      "sort_order": 4,
      "access_tier": "member"
    },
    {
      "id": "changes",
      "group": "經典研究",
      "title": "《易》、卦爻與筮法",
      "track": "topics",
      "sort_order": 5,
      "access_tier": "member"
    },
    {
      "id": "divination",
      "group": "術數史",
      "title": "蓍龜、雜占與占卜活動",
      "track": "topics",
      "sort_order": 6,
      "access_tier": "member"
    },
    {
      "id": "forms",
      "group": "空間與身體",
      "title": "形法、地理與空間判讀",
      "track": "topics",
      "sort_order": 7,
      "access_tier": "member"
    },
    {
      "id": "medicine",
      "group": "方技史",
      "title": "醫經、經方與身體觀",
      "track": "topics",
      "sort_order": 8,
      "access_tier": "member"
    },
    {
      "id": "cultivation",
      "group": "宗教與身體",
      "title": "神仙、修養與技術",
      "track": "topics",
      "sort_order": 9,
      "access_tier": "member"
    },
    {
      "id": "boards",
      "group": "技術專題",
      "title": "式占與推演結構",
      "track": "topics",
      "sort_order": 10,
      "access_tier": "member"
    },
    {
      "id": "military",
      "group": "技術專題",
      "title": "兵陰陽與軍事數術",
      "track": "topics",
      "sort_order": 11,
      "access_tier": "member"
    }
  ],
  "mansions": [
    {
      "id": "mansion-角",
      "group": "東方青龍",
      "title": "角宿",
      "track": "mansions",
      "sort_order": 1,
      "access_tier": "member"
    },
    {
      "id": "mansion-亢",
      "group": "東方青龍",
      "title": "亢宿",
      "track": "mansions",
      "sort_order": 2,
      "access_tier": "member"
    },
    {
      "id": "mansion-氐",
      "group": "東方青龍",
      "title": "氐宿",
      "track": "mansions",
      "sort_order": 3,
      "access_tier": "member"
    },
    {
      "id": "mansion-房",
      "group": "東方青龍",
      "title": "房宿",
      "track": "mansions",
      "sort_order": 4,
      "access_tier": "member"
    },
    {
      "id": "mansion-心",
      "group": "東方青龍",
      "title": "心宿",
      "track": "mansions",
      "sort_order": 5,
      "access_tier": "member"
    },
    {
      "id": "mansion-尾",
      "group": "東方青龍",
      "title": "尾宿",
      "track": "mansions",
      "sort_order": 6,
      "access_tier": "member"
    },
    {
      "id": "mansion-箕",
      "group": "東方青龍",
      "title": "箕宿",
      "track": "mansions",
      "sort_order": 7,
      "access_tier": "member"
    },
    {
      "id": "mansion-斗",
      "group": "北方玄武",
      "title": "斗宿",
      "track": "mansions",
      "sort_order": 8,
      "access_tier": "member"
    },
    {
      "id": "mansion-牛",
      "group": "北方玄武",
      "title": "牛宿",
      "track": "mansions",
      "sort_order": 9,
      "access_tier": "member"
    },
    {
      "id": "mansion-女",
      "group": "北方玄武",
      "title": "女宿",
      "track": "mansions",
      "sort_order": 10,
      "access_tier": "member"
    },
    {
      "id": "mansion-虛",
      "group": "北方玄武",
      "title": "虛宿",
      "track": "mansions",
      "sort_order": 11,
      "access_tier": "member"
    },
    {
      "id": "mansion-危",
      "group": "北方玄武",
      "title": "危宿",
      "track": "mansions",
      "sort_order": 12,
      "access_tier": "member"
    },
    {
      "id": "mansion-室",
      "group": "北方玄武",
      "title": "室宿",
      "track": "mansions",
      "sort_order": 13,
      "access_tier": "member"
    },
    {
      "id": "mansion-壁",
      "group": "北方玄武",
      "title": "壁宿",
      "track": "mansions",
      "sort_order": 14,
      "access_tier": "member"
    },
    {
      "id": "mansion-奎",
      "group": "西方白虎",
      "title": "奎宿",
      "track": "mansions",
      "sort_order": 15,
      "access_tier": "member"
    },
    {
      "id": "mansion-婁",
      "group": "西方白虎",
      "title": "婁宿",
      "track": "mansions",
      "sort_order": 16,
      "access_tier": "member"
    },
    {
      "id": "mansion-胃",
      "group": "西方白虎",
      "title": "胃宿",
      "track": "mansions",
      "sort_order": 17,
      "access_tier": "member"
    },
    {
      "id": "mansion-昴",
      "group": "西方白虎",
      "title": "昴宿",
      "track": "mansions",
      "sort_order": 18,
      "access_tier": "member"
    },
    {
      "id": "mansion-畢",
      "group": "西方白虎",
      "title": "畢宿",
      "track": "mansions",
      "sort_order": 19,
      "access_tier": "member"
    },
    {
      "id": "mansion-觜",
      "group": "西方白虎",
      "title": "觜宿",
      "track": "mansions",
      "sort_order": 20,
      "access_tier": "member"
    },
    {
      "id": "mansion-參",
      "group": "西方白虎",
      "title": "參宿",
      "track": "mansions",
      "sort_order": 21,
      "access_tier": "member"
    },
    {
      "id": "mansion-井",
      "group": "南方朱雀",
      "title": "井宿",
      "track": "mansions",
      "sort_order": 22,
      "access_tier": "member"
    },
    {
      "id": "mansion-鬼",
      "group": "南方朱雀",
      "title": "鬼宿",
      "track": "mansions",
      "sort_order": 23,
      "access_tier": "member"
    },
    {
      "id": "mansion-柳",
      "group": "南方朱雀",
      "title": "柳宿",
      "track": "mansions",
      "sort_order": 24,
      "access_tier": "member"
    },
    {
      "id": "mansion-星",
      "group": "南方朱雀",
      "title": "星宿",
      "track": "mansions",
      "sort_order": 25,
      "access_tier": "member"
    },
    {
      "id": "mansion-張",
      "group": "南方朱雀",
      "title": "張宿",
      "track": "mansions",
      "sort_order": 26,
      "access_tier": "member"
    },
    {
      "id": "mansion-翼",
      "group": "南方朱雀",
      "title": "翼宿",
      "track": "mansions",
      "sort_order": 27,
      "access_tier": "member"
    },
    {
      "id": "mansion-軫",
      "group": "南方朱雀",
      "title": "軫宿",
      "track": "mansions",
      "sort_order": 28,
      "access_tier": "member"
    }
  ]
};
