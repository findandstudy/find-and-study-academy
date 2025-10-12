import { useState } from 'react';
import { Play, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  duration?: number;
}

const getVideoType = (url: string): 'youtube' | 'vimeo' | 'storage' | 'unknown' => {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('vimeo.com')) {
    return 'vimeo';
  }
  if (url.includes('storage.googleapis.com') || url.includes('.mp4') || url.includes('.webm')) {
    return 'storage';
  }
  return 'unknown';
};

const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^&\s]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const getVimeoVideoId = (url: string): string | null => {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export function VideoPlayer({ videoUrl, title, duration }: VideoPlayerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoType = getVideoType(videoUrl);
  
  const renderVideo = () => {
    switch (videoType) {
      case 'youtube': {
        const videoId = getYouTubeVideoId(videoUrl);
        if (!videoId) return <div className="text-muted-foreground">Invalid YouTube URL</div>;
        
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={title || 'YouTube video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            data-testid="youtube-player"
          />
        );
      }
      
      case 'vimeo': {
        const videoId = getVimeoVideoId(videoUrl);
        if (!videoId) return <div className="text-muted-foreground">Invalid Vimeo URL</div>;
        
        return (
          <iframe
            src={`https://player.vimeo.com/video/${videoId}`}
            title={title || 'Vimeo video'}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            data-testid="vimeo-player"
          />
        );
      }
      
      case 'storage':
        return (
          <video
            src={videoUrl}
            controls
            className="w-full h-full bg-black"
            data-testid="video-player"
          >
            Your browser does not support the video tag.
          </video>
        );
      
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Unsupported video format
          </div>
        );
    }
  };

  return (
    <Card className="overflow-hidden border-primary/10" data-testid="video-player-container">
      <div className="relative bg-black aspect-video">
        {renderVideo()}
      </div>
      
      {(title || duration) && (
        <div className="p-4 border-t border-border/50 bg-card/50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {title && (
                <h4 className="font-medium text-sm" data-testid="video-title">{title}</h4>
              )}
            </div>
            {duration && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Play className="w-4 h-4" />
                <span data-testid="video-duration">{formatDuration(duration)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
