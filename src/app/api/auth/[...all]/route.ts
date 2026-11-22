import { auth } from "@/server/auth";

const handler = async (request: Request) => (await auth()).handler(request);

export { handler as GET, handler as POST };
