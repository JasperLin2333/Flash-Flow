import { supabase } from "@/lib/supabase";

export const fileUploadService = {
    /**
     * Upload file to Supabase Storage
     * @returns Object with URL and path, or null if failed
     */
    async uploadFile(
        file: File,
        nodeId: string,
        flowId: string
    ): Promise<{ url: string; path: string } | null> {
        try {
            const timestamp = Date.now();
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const storagePath = `${flowId}/${nodeId}/${timestamp}_${sanitizedName}`;

            const { data, error } = await supabase.storage
                .from("workflow-uploads")
                .upload(storagePath, file, {
                    cacheControl: "3600",
                    upsert: false,
                });

            if (error) throw error;

            const {
                data: { publicUrl },
            } = supabase.storage.from("workflow-uploads").getPublicUrl(storagePath);

            return { url: publicUrl, path: data.path };
        } catch (error) {
            console.error("File upload failed:", error);
            return null;
        }
    },

    /**
     * Save file metadata to database
     */
    async saveFileMetadata(
        nodeId: string,
        flowId: string,
        file: File,
        storagePath: string,
        storageUrl: string,
        uploadedBy?: string
    ): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from("file_uploads")
                .insert({
                    node_id: nodeId,
                    flow_id: flowId,
                    file_name: file.name,
                    file_type: file.type,
                    file_size: file.size,
                    storage_path: storagePath,
                    storage_url: storageUrl,
                    uploaded_by: uploadedBy,
                })
                .select("id")
                .single();

            if (error) throw error;
            return data.id;
        } catch (error) {
            console.error("Failed to save file metadata:", error);
            return null;
        }
    },

    /**
     * Complete file upload (storage + metadata)
     * This is the main function to use for uploading files
     */
    async completeUpload(
        file: File,
        nodeId: string,
        flowId: string,
        userId?: string
    ) {
        const uploadResult = await this.uploadFile(file, nodeId, flowId);
        if (!uploadResult) return null;

        const metadataId = await this.saveFileMetadata(
            nodeId,
            flowId,
            file,
            uploadResult.path,
            uploadResult.url,
            userId
        );

        return metadataId
            ? {
                id: metadataId,
                url: uploadResult.url,
                name: file.name,
                size: file.size,
                type: file.type,
            }
            : null;
    },

    /**
     * Get files for a specific node
     */
    async getNodeFiles(nodeId: string) {
        const { data, error } = await supabase
            .from("file_uploads")
            .select("*")
            .eq("node_id", nodeId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Failed to fetch files:", error);
            return [];
        }

        return data || [];
    },

    /**
     * Delete file from storage and database
     */
    async deleteFile(fileId: string, storagePath: string) {
        try {
            // Delete from storage
            const { error: storageError } = await supabase.storage
                .from("workflow-uploads")
                .remove([storagePath]);

            if (storageError) throw storageError;

            // Delete from database
            const { error: dbError } = await supabase
                .from("file_uploads")
                .delete()
                .eq("id", fileId);

            if (dbError) throw dbError;

            return true;
        } catch (error) {
            console.error("Failed to delete file:", error);
            return false;
        }
    },
};
