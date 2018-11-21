var Koa = require("koa");
const Router = require("koa-router");
const axios = require("axios");
const mongoose = require("mongoose");

var router = new Router();

var hashtagSchema = new mongoose.Schema({
  _id: String,
  eventId: String,
  title: String,
  hashtag: String,
  now: Boolean
});

var Hashtag = mongoose.model("Hashtag", hashtagSchema);

const connectionString = process.env.CONNECTION_STRING;

const getFixtures = async () => {
  const endpoint = process.env.ENDPOINT;
  console.log('>>>>>>', endpoint)
  const today = new Date().toISOString().split("T")[0];
  const target = `${endpoint}v1/EPG?date=${today}&country=de&languageCode=en&filters=Sport%3A289u5typ3vp4ifwh5thalohmq`;
  console.log('>>>', target);
  const res = await axios.get(target);
  const body = res.data;
  const items = body.Tiles;

  if (!items.length) {
    return;
  }
  const fixtures = items.map(item => ({
    eventId: item.EventId,
    title: item.Title,
    start: item.Start
  }));
  return fixtures;
};

const generateHashtag = fixture => {
  const titleBits = fixture.title.split(" v ");
  const home = titleBits[0].replace(/\s/g, "");
  const away = titleBits[1] ? titleBits[1].replace(/\s/g, "") : null;
  if (away) {
    return `DAZN${home}${away}`;
  } else return `DAZN${home}`;
};

const generateHashtags = async fixtures => {
  console.log('>>>>>', fixtures)
  const newItems = fixtures.map(fixture => ({
    eventId: fixture.eventId,
    title: fixture.title,
    hashtag: generateHashtag(fixture),
    start: fixture.start
  }));
  return newItems;
};

const connectToMongo = async () => {
  try {
    mongoose.connect(
      connectionString,
      { useNewUrlParser: true }
    );
  } catch (err) {
    console.error(err.message, "Oh Snap!");
  }
};

const checkIfEventIsLive = (startTime) => {
  const startMs = new Date(startTime).getTime();
  const nowMs = new Date().getTime();
  const MS_PER_MINUTE = 60000;
  const thirtyMinsBeforeStart = startMs - (MS_PER_MINUTE * 30);
  const twoHoursAfterStart = startMs + (MS_PER_MINUTE * 120);

  if ((nowMs > thirtyMinsBeforeStart) && (nowMs < twoHoursAfterStart) ) {
    return true;
  } else {
    return false
  }
}

const syncToMongo = async () => {
  const fixtures = await getFixtures();
  const hashtags = await generateHashtags(fixtures);
  hashtags.forEach(item => {
    const Item = new Hashtag({
      _id: item.eventId,
      eventId: item.eventId,
      title: item.title,
      hashtag: item.hashtag,
      now: checkIfEventIsLive(item.start)
    });
    var upsertData = Item.toObject();
    Hashtag.update({ _id: Item.eventId }, upsertData, { upsert: true }, err => {
      if (err) {
        console.err(err);
      }
      console.log(`upserted eventId ${item.eventId}!`);
    });
  });
};

const getHashtags = async ctx => {
  const all = await Hashtag.find({});
  const res = all.map(item => ({
    [item.eventId]: {
      title: item.title,
      hashtag: item.hashtag,
      now: checkIfEventIsLive(item.start)
    }
  }));
  ctx.body = res;
  ctx.status = 200;
};

const getHashtagByEventId = async ctx => {
  const eventId = ctx.params.eventId;
  const one = await Hashtag.findOne({ eventId: eventId });
  ctx.body = {
    [eventId]: {
      title: one.title,
      hashtag: one.hashtag,
      now: one.now,
    }
  };
  ctx.status = 200;
};

const syncFixtures = async () => {
  await connectToMongo();
  var db = mongoose.connection;
  db.on("error", console.error.bind(console, "connection error:"));
  db.once("open", function() {
    console.log("Connected to Mongo");
  });
  await syncToMongo(db);
}

const init = async () => {
  console.info("Server has started. Initializing routes.");
  await syncFixtures();
  router.get("/", ctx => {
    ctx.status = 200;
  });
  router.get("/hashtags", getHashtags);
  router.get("/hashtag/:eventId", getHashtagByEventId);
  const app = new Koa();
  app.use(router.routes());
  const port_number = process.env.PORT || 3000;
  app.listen(port_number);
  app.listen();
  console.info(`Listening on ${port_number}`);
};

module.exports = { init, syncFixtures };
