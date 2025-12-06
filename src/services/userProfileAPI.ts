/**
 * User Profile API Service
 * Handles CRUD operations for user profiles (display name, avatar)
 */

import { supabase } from "@/lib/supabase";

export interface UserProfile {
    id: string;
    user_id: string;
    display_name: string | null;
    avatar_kind: "emoji" | "image";
    avatar_emoji: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserProfileUpdate {
    display_name?: string;
    avatar_kind?: "emoji" | "image";
    avatar_emoji?: string | null;
    avatar_url?: string | null;
}

class UserProfileAPI {
    /**
     * Get user profile by user ID
     * Note: Using type assertion since user_profiles table is new and not in generated types yet
     */
    async getProfile(userId: string): Promise<UserProfile | null> {
        const { data, error } = await (supabase as any)
            .from("user_profiles")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error) {
            // Profile doesn't exist yet, return null
            if (error.code === "PGRST116") {
                return null;
            }
            console.error("Error fetching user profile:", error);
            return null;
        }

        return data as UserProfile;
    }

    /**
     * Create or update user profile
     */
    async upsertProfile(userId: string, profile: UserProfileUpdate): Promise<UserProfile | null> {
        const { data, error } = await (supabase as any)
            .from("user_profiles")
            .upsert(
                {
                    user_id: userId,
                    ...profile,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
            )
            .select()
            .single();

        if (error) {
            console.error("Error upserting user profile:", error);
            return null;
        }

        return data as UserProfile;
    }

    /**
     * Update display name
     */
    async updateDisplayName(userId: string, displayName: string): Promise<UserProfile | null> {
        return this.upsertProfile(userId, { display_name: displayName });
    }

    /**
     * Update avatar with emoji
     */
    async updateAvatarEmoji(userId: string, emoji: string): Promise<UserProfile | null> {
        return this.upsertProfile(userId, {
            avatar_kind: "emoji",
            avatar_emoji: emoji,
            avatar_url: null,
        });
    }

    /**
     * Update avatar with uploaded image URL
     */
    async updateAvatarImage(userId: string, imageUrl: string): Promise<UserProfile | null> {
        return this.upsertProfile(userId, {
            avatar_kind: "image",
            avatar_emoji: null,
            avatar_url: imageUrl,
        });
    }

    /**
     * Upload avatar image to Supabase Storage
     */
    async uploadAvatar(file: File, userId: string): Promise<string | null> {
        // Generate unique filename
        const ext = file.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${ext}`;

        const { data, error } = await supabase.storage
            .from("user-avatars")
            .upload(fileName, file, {
                cacheControl: "3600",
                upsert: true,
            });

        if (error) {
            console.error("Error uploading avatar:", error);
            return null;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from("user-avatars")
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    }
}

export const userProfileAPI = new UserProfileAPI();

