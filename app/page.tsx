import { getAllPosts } from "@/app/lib/server-data";
import HomePage from "./HomePage";

export default async function Home() {
  const posts = await getAllPosts();

  return <HomePage initialPosts={posts} />;
}
