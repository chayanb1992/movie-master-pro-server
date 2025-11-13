const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const userWatchList = collectionDB.collection("usersData");

    app.get("/allmovies", async (req, res) => {
      const result = await movieCollection.find().toArray();
      res.send(result);
    });
    // app.get("/top-rated", async (req, res) => {
    //   try {
    //     const topMovies = await movieCollection
    //       .find({}, { projection: { _id: 0 } })
    //       .sort({ rating: -1 })
    //       .limit(5)
    //       .toArray();
    //     res.send(topMovies);
    //   } catch (error) {
    //     console.error("Error fetching top-rated movies:", error);
    //     res.status(500).send({ message: "Failed to fetch top-rated movies" });
    //   }
    // });
    app.get("/top-rated", async (req, res) => {
      try {
        // Get min and max ratings from query params (default 0–10)
        const minRating = parseFloat(req.query.min) || 0;
        const maxRating = parseFloat(req.query.max) || 10;

        // Find movies within the rating range
        const topMovies = await movieCollection
          .find(
            { rating: { $gte: minRating, $lte: maxRating } },
            { projection: { _id: 0 } }
          )
          .sort({ rating: -1 }) // Sort descending by rating
          .limit(5)
          .toArray();

        res.send(topMovies);
      } catch (error) {
        console.error("Error fetching top-rated movies:", error);
        res.status(500).send({ message: "Failed to fetch top-rated movies" });
      }
    });
    app.get("/recently-added", async (req, res) => {
      try {
        const recentMovies = await movieCollection
          .find({}, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        res.send(recentMovies);
      } catch (error) {
        console.error("Error fetching recently added movies:", error);
        res
          .status(500)
          .send({ message: "Failed to fetch recently added movies" });
      }
    });
    app.post("/users", async (req, res) => {
      const data = req.body;
      const result = await movieCollection.insertOne(data);
      res.send(result);
    });

    app.post("/movies/add", async (req, res) => {
      const movie = req.body;
      console.log(movie);
      const result = await movieCollection.insertOne(movie);
      res.send(result);
    });
    // Get all movies added by a specific user
    app.get("/my-collection", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) return res.status(400).json({ message: "Email required" });

      try {
        const result = await movieCollection.find({ addedBy: email }).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch movies" });
      }
    });
    app.get("/movies/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const movie = await movieCollection.findOne(query);
        // console.log(movie);
        if (!movie) {
          return res.status(404).json({ message: "Movie not found" });
        }
        res.json(movie);
      } catch (err) {
        res.status(500).json({ message: "Error fetching movie" });
      }
    });

    // Delete a movie by ID
    app.delete("/delete-movie/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await movieCollection.deleteOne(query);
        if (result.deletedCount === 1) {
          res.json({ success: true });
        } else {
          res.status(404).json({ message: "Movie not found" });
        }
      } catch (error) {
        res.status(500).json({ message: "Failed to delete movie" });
      }
    });

    app.patch("/update/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      console.log(updatedData.title);
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          title: updatedData.title,
          genre: updatedData.genre,
          releaseYear: updatedData.releaseYear,
          director: updatedData.director,
          cast: updatedData.cast,
          rating: updatedData.rating,
          duration: updatedData.duration,
          plotSummary: updatedData.plotSummary,
          posterUrl: updatedData.posterUrl,
          language: updatedData.language,
          country: updatedData.country,
        },
      };
      try {
        const result = await movieCollection.updateOne(query, update);
        res.json(result);
      } catch (err) {
        res.status(500).json({ message: "Error updating movie" });
      }
    });

    app.post("/movies/addToWatchList", async (req, res) => {
      try {
        const { email, id } = req.body;

        if (!email || !id) {
          return res
            .status(400)
            .send({ message: "Missing email or movie ID." });
        }

        const existingUser = await userWatchList.findOne({ email });

        if (existingUser) {
          // Check if movie already exists in the user's watchlist
          if (existingUser.watchList?.includes(id)) {
            return res.status(200).send({ message: "Already in watchlist." });
          }

          // Add movie to watchlist
          const updateResult = await userWatchList.updateOne(
            { email },
            { $push: { watchList: id } }
          );

          return res.status(200).send({
            message: "Movie added to watchlist.",
            result: updateResult,
          });
        } else {
          // Create a new document for this user
          const newUserData = {
            email,
            watchList: [id],
          };
          const insertResult = await userWatchList.insertOne(newUserData);
          return res.status(201).send({
            message: "User created and movie added to watchlist.",
            result: insertResult,
          });
        }
      } catch (error) {
        console.error("Error adding to watchlist:", error);
        res.status(500).send({ message: "Server error", error });
      }
    });
    // app.get("/watchlist", async (req, res) => {
    //   const result = await movieCollection.find().toArray();
    //   res.send(result);
    // });

    app.get("/watchlist", async (req, res) => {
      const email = req.query.email;
      console.log("Watchlist query for email:", email);

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      try {
        const userData = await userWatchList.findOne({ email });

        if (!userData) {
          return res.status(200).json({ watchList: [] });
        }

        // Just return the watchlist (as strings)
        const watchList = (userData.watchList || []).map((id) => String(id));
        res.status(200).json({ watchList });
      } catch (err) {
        console.error("Error fetching watchlist:", err);
        res.status(500).json({ message: "Server error fetching watchlist" });
      }
    });

    app.post("/movies/removeFromWatchList", async (req, res) => {
      try {
        const { email, id } = req.body;
        if (!email || !id)
          return res.status(400).send({ message: "Missing email or movie ID" });

        const result = await userWatchList.updateOne(
          { email },
          { $pull: { watchList: id } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).send({ message: "Removed from watchlist" });
        } else {
          res.status(404).send({ message: "Movie not found in watchlist" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
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
