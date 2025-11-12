const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const dotenv = require("dotenv");

const uri =
  "mongodb+srv://simpleDBuser:DwhuP4Omy4j8i8pY@cluster0.it01qhi.mongodb.net/?appName=Cluster0";

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server Connected");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

dotenv.config();
console.log("Loaded private key:", !!process.env.FIREBASE_PRIVATE_KEY);

//get firebase all users
admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
  }),
});

// ✅ Create API endpoint to get total users
app.get("/total-users", async (req, res) => {
  try {
    const listUsers = await admin.auth().listUsers();
    // console.log(listUsers);
    res.json({ totalUsers: listUsers.users.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function run() {
  try {
    await client.connect();
    const collectionDB = client.db("Movie_Master");
    const movieCollection = collectionDB.collection("Movies");

    app.get("/allmovies", async (req, res) => {
      const result = await movieCollection.find().toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const data = req.body;
      const result = await movieCollection.insertOne(data);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB connected successfully");

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error("Connection error:", err);
  }
}

run().catch(console.dir);
