import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export const ensureAnonymousAuth = async (): Promise<User> => {
    const current = auth.currentUser;
    if (current) {
        return current;
    }

    await signInAnonymously(auth);

    const user = await new Promise<User>((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => {
            if (!u) {
                return;
            }
            unsub();
            resolve(u);
        });
    });

    return user;
};
