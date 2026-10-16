
import { Link } from "react-router-dom";

function Home() {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "80px auto",
        padding: "24px",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Welcome to RiseTogether</h1>

      <p>Connect. Share. Grow Together.</p>

      <p>
        A community where young people share ideas, connect
        with others, and grow together.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginTop: "30px",
        }}
      >
        <Link to="/login">Log In</Link>

        <Link to="/register">Create an Account</Link>
      </div>
    </main>
  );
}

export default Home;
