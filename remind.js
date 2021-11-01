const schedule = require("node-schedule");
const axios = require("axios");
const qs = require("qs");
const log4js = require("log4js");
const dayjs = require('dayjs')

log4js.configure({
  appenders: {
    file: {
      type: "file",
      filename: "app.log",
      layout: {
        type: "pattern",
        pattern: "%r %p - %m",
      },
    },
  },
  categories: {
    default: {
      appenders: ["file"],
      level: "debug",
    },
  },
});

const logger = log4js.getLogger();

axios.defaults.headers.post["Content-Type"] = "application/json";

const mentionedMobileList = [
  "18670771715",
  "18890030594",
  "15756290280",
  "15812417452",
  "18500558906",
  "15901397038",
  "16602756604",
];

function random(min, max) {
  return parseInt(Math.random() * (max - min + 1) + min, 10);
}

function wordTemplate(type, holiday) {
  const template = [`各位小伙伴记得按时填写${type}哦，不然一天的代码又白写了～`, `各位小伙伴记得按时填写${type}哦，不然一天的代码又白写了～`];
  let result = template[random(0, 1)]
  if (holiday.nextHolidayName) {
    result =  result + `\n\n明天是${holiday.nextHolidayName}，祝大家节日快乐！`
  } else if (holiday.nextWorkdayName && !holiday.nextWorkdayName.includes('周')) {
    result = result + `\n\n明天是${holiday.nextWorkdayName}，记得调好闹钟哦！`
  }
  return result;
}

/**
 * 工时提醒1
 * @param {*} params
 */
async function workTimeRemind1() {
  let job = schedule.scheduleJob("0 20 17 * * *",async () => {
    const holiday = await checkHoliday()

    if (holiday.isHoliday) {
      logger.info("workTimeRemind1 holiday", holiday);
      return
    }

    const content = wordTemplate("工时", holiday);
    logger.info("workTimeRemind1", content);
    postMessage(content, mentionedMobileList);
  });
}

/**
 * 周报提醒1
 * @param {*} params
 */
async function weeklyRemind1() {
  let job = schedule.scheduleJob("0 35 17 ? * 5", async () => {
    const holiday = await checkHoliday()

    if (holiday.isHoliday || holiday.nextWorkdayName) {
      logger.info("weeklyRemind1 holiday", holiday);
      return
    }

    const content = `到点了，明天是周六哦！是写周报还是交罚款，你自己定。`;
    logger.info("weeklyRemind1", content);
    postMessage(content, mentionedMobileList);
  });
}

/**
 * 周报提醒2
 * @param {*} params
 */
async function weeklyRemind2() {
  let job = schedule.scheduleJob("0 0 21 ? * 7", async () => {
    const holiday = await checkHoliday()
    if (!(holiday.isHoliday && holiday.nextWorkdayName)) {
      logger.info("weeklyRemind2 holiday", holiday);
      return
    }

    const content = "周报还没写的赶紧写，再不写就要乐捐了！";
    logger.info("weeklyRemind2", content);
    postMessage(content, mentionedMobileList);
  });
}

/**
 * 温馨提醒
 * @param {*} params
 */
function reminder() {
  let job = schedule.scheduleJob("0 0 9 ? * 1,2,3,4,5", async () => {
    const res = await getSaying();
    logger.info("reminder", res.note);
    const res2 = await getAirQuality();
    logger.info("reminder", res2);
    if (res && res2) {
      logger.info("准备发送温馨提醒");
      postMessage(
        `【每日一句】\n${res.note}\n【空气质量】二氧化硫：${res2.so2}\n二氧化氮：${res2.no2}\npm10：${res2.pm10}\npm2.5：${res2.pm2_5}\n空气质量：${res2.quality}`
      );
    }
  });
}

/**
 * 获取名言
 * @param {*} params
 * @returns
 */
async function getSaying() {
  try {
    const res = await axios.post(
      `https://api.tianapi.com/txapi/everyday/index`,
      qs.stringify({
        key: "dcb8869c3dbcd389121e3019d5099f0e",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    if (res.data.code === 200) {
      return res.data.newslist[0];
    } else {
      logger.info(res);
    }
  } catch (error) {
    logger.error(error);
  }
}

async function getAirQuality() {
  try {
    const res = await axios.post(
      `http://api.tianapi.com/txapi/aqi/index`,
      qs.stringify({
        key: "dcb8869c3dbcd389121e3019d5099f0e",
        area: "长沙",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    if (res.data.code === 200) {
      return res.data.newslist[0];
    } else {
      logger.info(res);
    }
  } catch (error) {
    logger.error(error);
  }
}

async function postMessage(content, mentioned_mobile_list) {
  try {
    const res = await axios.post(
      `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=931bc825-086f-410d-b3a5-680a0a73e984`,
      {
        msgtype: "text",
        text: {
          content: content,
          // mentioned_mobile_list: mentioned_mobile_list,
          mentioned_list: ["@all"]
        },
      },
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    logger.info(res.data);
  } catch (error) {
    logger.error(error);
  }
}

async function getHolidays(dateStr) {
  try {
    const res = await axios.get(
      `http://timor.tech/api/holiday/info/${dateStr}`,
    );
    if (res.data.code === 0) {
      return res.data
    } else {
      logger.info(res);
    }
  } catch (error) {
    logger.error(error);
  }
}

async function getNextHolidays() {
  try {
    const res = await axios.get(
      `http://timor.tech/api/holiday/next/2021-5-2`,
    );
    console.log('res', res.data);
    if (res.data.code === 0) {
      return res.data
    } else {
      logger.info(res);
    }
  } catch (error) {
    logger.error(error);
  }
}

async function getHolidaysTts() {
  try {
    const res = await axios.get(
      `http://timor.tech/api/holiday/tts`,
    );
    console.log('res', res.data);
    if (res.data.code === 0) {
      return res.data
    } else {
      logger.info(res);
    }
  } catch (error) {
    logger.error(error);
  }
}

async function checkHoliday() {
  const result = {
    nextHolidayName: '',
    nextWorkdayName: '',
    isHoliday: false,
  }
  const date = dayjs()
  const res = await getHolidays(date.format('YYYY-MM-DD'))
  const res2 = await getHolidays(date.add(1, 'day').format('YYYY-MM-DD'))
  if (res2) {
    result.nextHolidayName = res2.type.type === 2 ? res2.type.name : ''
    result.nextWorkdayName = res2.type.type === 3 || res2.type.type === 0 ? res2.type.name : ''
    result.isHoliday = [1,2].includes(res.type.type)
  }
  logger.info('checkHoliday', date.format('YYYY-MM-DD'), result)
  return result
}

function isWeekend() {
  const day = new Date().getDay()
  return day === 0 || day === 6
}

async function main(params) {
  logger.info("启动脚本");
  workTimeRemind1();
  // workTimeRemind2();
  weeklyRemind1();
  weeklyRemind2();
  //reminder()
  logger.info("启动成功");
}

main();
