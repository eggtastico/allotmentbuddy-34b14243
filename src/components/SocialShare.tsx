import { Facebook, Twitter, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface SocialShareProps {
  title?: string;
  text?: string;
}

export function SocialShare({ title = 'My Allotment Garden', text = 'Check out my allotment garden plan on Allotment Buddy! 🌱🥕' }: SocialShareProps) {
  const url = window.location.href;

  const shareToFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
    window.open(fbUrl, '_blank', 'width=600,height=400');
  };

  const shareToX = () => {
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(xUrl, '_blank', 'width=600,height=400');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 min-h-[40px] text-xs rounded-2xl gap-1.5">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl">
        <DropdownMenuItem onClick={shareToFacebook} className="gap-2 cursor-pointer rounded-xl">
          <Facebook className="h-4 w-4 text-blue-600" />
          Share on Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToX} className="gap-2 cursor-pointer rounded-xl">
          <Twitter className="h-4 w-4" />
          Share on X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink} className="gap-2 cursor-pointer rounded-xl">
          <Share2 className="h-4 w-4 text-primary" />
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
