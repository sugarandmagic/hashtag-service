var Koa = require("koa");
const Router = require("koa-router");
const axios = require("axios");
const mongoose = require("mongoose");

var router = new Router();

var hashtagSchema = new mongoose.Schema({
  eventId: String,
  title: String,
  hashtag: String
});

var Hashtag = mongoose.model('Hashtag', hashtagSchema);

const connectionString =
  "mongodb://hashtag-service-user:P0tato@ds247223.mlab.com:47223/hashtags";

const getFixtures = async () => {
  const endpoint = "https://cdn.dazn.com/misl/eu/";
  const today = new Date().toISOString().split("T")[0];
  const target = `${endpoint}v1/EPG?date=${today}&country=de&languageCode=en&filters=Sport%3A289u5typ3vp4ifwh5thalohmq`;

  const res = await axios.get(target);
  const body = res.data;
  const items = body.Tiles;

  if (!items.length) {
    return;
  }
  const fixtures = items.map(item => ({
    eventId: item.EventId,
    title: item.Title
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
  const newItems = fixtures.map(fixture => ({
    eventId: fixture.eventId,
    title: fixture.title,
    hashtag: generateHashtag(fixture)
  }));
  return newItems;
};

const connectToMongo = async () => {
  try {
    mongoose.connect(connectionString, { useNewUrlParser: true });
  } catch (err) {
    console.error(err.message, "Oh Snap!");
  }
};

const syncToMongo = async () => {
  const fixtures = await getFixtures();
  const hashtags = await generateHashtags(fixtures);
  hashtags.forEach(item => {
    const Item = new Hashtag({eventId: item.eventId, title: item.title, hashtag: item.hashtag});
    Item.save();
  });
}

const getHashtags = async ctx => {
  const all = await Hashtag.find({});
  const res = all.map(item => ({
    [item.eventId]: {
      title: item.title,
      hashtag: item.hashtag
    }
  }))
  console.log('yayaaaa!')
  console.log(all);
  ctx.body = res;
  ctx.status = 200;
};

const getHashtagByEventId = async (ctx) => {
  const eventId = ctx.params.eventId
  const one = await Hashtag.findOne({ eventId: eventId });
  
  // fetch from mongo single item by ID
  console.log('yay!')
  ctx.body = {
    [eventId]: {
      title: one.title,
      hashtag: one.hashtag
    }
  };
  ctx.status = 200;
};


const init = async () => {
  console.info("Server has started. Initializing routes.");
  await connectToMongo();
  var db = mongoose.connection;
  db.on("error", console.error.bind(console, "connection error:"));
  db.once("open", function() {
    console.log("Connected to Mongo");
  });
  await syncToMongo(db);
  router.get('/', (ctx) => {
    ctx.status = 200
  });
  router.get("/hashtags", getHashtags);
  router.get("/hashtag/:eventId", getHashtagByEventId)
  const app = new Koa();
  app.use(router.routes());
  const port_number = process.env.PORT || 3000;
  app.listen(port_number);
  app.listen();
};

module.exports = { init }
