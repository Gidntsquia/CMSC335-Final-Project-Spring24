const path = require("path");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: false }));

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const uri = process.env.MONGO_CONNECTION_STRING;
const databaseAndCollection = {
  db: process.env.MONGO_DB_NAME,
  collection: process.env.MONGO_COLLECTION,
};

let portNumber;

app.set("views", path.resolve(__dirname, "templates"));
app.use(express.static(__dirname + "/css"));
app.set("view engine", "ejs");

const { MongoClient, ServerApiVersion } = require("mongodb");
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

async function main() {
  portNumber = 3000;

  app.listen(portNumber);
  console.log(
    `Web Server started and running at http://localhost:${portNumber}`
  );
  process.stdout.write("Stop to shutdown the server: ");

  process.stdin.on("readable", () => {
    dataInput = "";

    // Get the full input
    line = process.stdin.read();
    while (line !== null) {
      dataInput += line;
      line = process.stdin.read();
    }

    if (dataInput !== null) {
      const command = dataInput.trim();
      if (command.toLowerCase() === "stop") {
        console.log("Shutting down the server");
        process.exit(0); /* exiting */
      } else {
        /* After invalid command, we cannot type anything else */
        console.log(`Invalid command: ${command}`);
      }
    }
    process.stdout.write("Stop to shutdown the server: ");
  });
}

app.get("/", async (request, response) => {
  const recentNames = await lookUpMostRecentNames(5);
  let recentSearchList = "<ol>";

  recentNames?.forEach((elem) => {
    recentSearchList += `<li>${elem.name}</li>`;
  });

  recentSearchList += "</ol>";

  const variables = {
    recentSearchList: recentSearchList,
  };
  response.render("index", variables);
});

app.post("/processName", async (request, response) => {
  const name = request.body.name;
  let fetchResponse = await fetch(`https://api.nationalize.io/?name=${name}`);
  const nationalityInfo = await fetchResponse.json();
  const countryCode = nationalityInfo.country[0].country_id;

  fetchResponse = await fetch(
    `https://restcountries.com/v3.1/alpha?codes=${countryCode}`
  );
  const countryObj = await fetchResponse.json();
  const countryName = countryObj[0].name.common;

  fetchResponse = await fetch(`https://api.genderize.io/?name=${name}`);
  const genderInfo = await fetchResponse.json();

  fetchResponse = await fetch(`https://api.agify.io?name=${name}`);
  const ageInfo = await fetchResponse.json();

  insertNameToMongo(name);

  const variables = {
    name: name,
    nationality: countryName,
    gender: genderInfo.gender,
    age: ageInfo.age,
  };

  response.render("processName", variables);
});

async function insertNameToMongo(name) {
  try {
    await client.connect();

    await client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .insertOne({ name: name });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

async function lookUpMostRecentNames(numNames) {
  let result;
  try {
    await client.connect();

    result = await client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .find()
      .sort({ _id: -1 })
      .limit(numNames)
      .toArray();
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }

  return result;
}

main().catch(console.error);

module.exports = app;
