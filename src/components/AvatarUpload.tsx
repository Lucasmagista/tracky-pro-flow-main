import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AvatarUploadProps {
  currentAvatar?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  onAvatarUpdate: (url: string) => void;
}

export const AvatarUpload = ({
  currentAvatar,
  userId,
  userName,
  userEmail,
  onAvatarUpdate
}: AvatarUploadProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!fileInputRef.current?.files?.[0]) return;

    setUploading(true);
    try {
      const file = fileInputRef.current.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      onAvatarUpdate(publicUrl);
      setPreview(null);

      toast({
        title: "Avatar atualizado!",
        description: "Sua foto de perfil foi alterada com sucesso.",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Erro ao fazer upload",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAvatar = async () => {
    if (!currentAvatar) return;

    try {
      // Extract file path from current avatar URL
      const url = new URL(currentAvatar);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];

      if (fileName) {
        // Remove from storage
        const { error: storageError } = await supabase.storage
          .from('avatars')
          .remove([fileName]);

        if (storageError) {
          console.warn('Error removing from storage:', storageError);
        }
      }

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (updateError) throw updateError;

      onAvatarUpdate('');
      setPreview(null);

      toast({
        title: "Avatar removido",
        description: "Sua foto de perfil foi removida.",
      });
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast({
        title: "Erro ao remover avatar",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const cancelUpload = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Avatar className="h-24 w-24 mx-auto">
          <AvatarImage src={preview || currentAvatar} />
          <AvatarFallback className="text-lg">
            {userName?.charAt(0)?.toUpperCase() || userEmail?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {preview && (
          <div className="absolute -top-2 -right-2 flex gap-1">
            <Button
              size="sm"
              variant="default"
              onClick={uploadAvatar}
              disabled={uploading}
              className="h-6 w-6 p-0"
            >
              <Upload className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={cancelUpload}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {!preview && (
        <div className="flex flex-col items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="avatar-upload"
          />
          <label htmlFor="avatar-upload">
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">
                <Camera className="mr-2 h-4 w-4" />
                Alterar Foto
              </span>
            </Button>
          </label>

          <p className="text-xs text-muted-foreground text-center">
            ou arraste uma imagem aqui
          </p>

          {currentAvatar && (
            <Button
              variant="outline"
              size="sm"
              onClick={removeAvatar}
            >
              <X className="mr-2 h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
      )}

      {uploading && (
        <p className="text-sm text-muted-foreground">Fazendo upload...</p>
      )}
    </div>
  );
};