app.post("/verify-x", sensitiveLimiter, async (req, res) => {
  try {
    const { username, wallet, fp } = req.body || {};
    if (!username) return res.status(400).json({ message: "Username required" });

    const ip = getIp(req);
    rememberActivity({ ip, fp, wallet: (wallet || "").toLowerCase() });

    const bearer = process.env.X_BEARER_TOKEN;
    const tweetId = process.env.AIRDROP_TWEET_ID;

    if (!bearer || !tweetId) {
      return res.status(500).json({ message: "X API not configured" });
    }

    /* ------------------ 1) USER INFO ------------------ */
    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=created_at,public_metrics,profile_image_url`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );
    const userData = await userRes.json();
    const user = userData?.data;
    if (!user) return res.status(400).json({ message: "User not found" });

    const userId = user.id;

    /* ------------------ 2) FOLLOW CHECK ------------------ */
    const followRes = await fetch(
      `https://api.twitter.com/2/users/${userId}/following?max_results=1000`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );
    const followData = await followRes.json();

    const followsUs = followData?.data?.some(
      acc => acc?.username?.toLowerCase() === "skylinelogicai"
    );

    if (!followsUs) {
      return res.status(400).json({ message: "User is not following SkylineLogicAI" });
    }

    /* ------------------ 3) RETWEET CHECK ------------------ */
    const retweetRes = await fetch(
      `https://api.twitter.com/2/users/${userId}/retweeted_tweets?max_results=100`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );
    const retweetData = await retweetRes.json();

    const didRT = retweetData?.data?.some(
      tw => tw?.id === tweetId
    );

    if (!didRT) {
      return res.status(400).json({ message: "Retweet not found" });
    }

    /* ------------------ 4) RISK SCORE ------------------ */
    const twitterScore = scoreTwitterUser(user);
    const ctxScore = scoreContext({ ip, fp });
    const risk = twitterScore + ctxScore;

    return res.json({
      success: true,
      risk,
      user: {
        id: user.id,
        username: user.username,
        followsUs,
        retweeted: didRT
      }
    });

  } catch (err) {
    console.error("verify-x error:", err);
    return res.status(500).json({ message: "Twitter API error" });
  }
});
