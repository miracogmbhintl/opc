import { useState, useEffect } from 'react';
import { ArrowLeft, Search, PlayCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface HowToGuidesProps {
  baseUrl: string;
}

interface Guide {
  id: string;
  title: string;
  category: string;
  videoUrl: string;
  description: string;
  instructions: string;
}

export default function HowToGuides({ baseUrl }: HowToGuidesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [filteredGuides, setFilteredGuides] = useState<Guide[]>([]);
  const [questionName, setQuestionName] = useState('');
  const [questionEmail, setQuestionEmail] = useState('');
  const [questionMessage, setQuestionMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const categories = ['all', 'getting-started', 'projects', 'feedback', 'settings', 'advanced'];

  useEffect(() => {
    fetchGuides();
  }, []);

  useEffect(() => {
    filterGuides();
  }, [searchQuery, selectedCategory, guides]);

  const fetchGuides = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/guides/list`);
      const data = await response.json();
      setGuides(data.guides || []);
    } catch (error) {
      console.error('Failed to fetch guides', error);
    }
  };

  const filterGuides = () => {
    let filtered = guides;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(guide => guide.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(guide =>
        guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredGuides(filtered);
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await fetch(`${baseUrl}/api/guides/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: questionName,
          email: questionEmail,
          message: questionMessage
        })
      });

      setShowSuccess(true);
      setQuestionName('');
      setQuestionEmail('');
      setQuestionMessage('');
      
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to submit question', error);
    }
  };

  return (
    <div className="mco-guides-page min-h-screen bg-[#f2f2f2] dark:bg-[#1a1a1a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] border-b border-[#1a1a1a]/10 dark:border-[#f2f2f2]/10 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="mb-4 font-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="font-heading text-4xl font-bold text-[#1a1a1a] dark:text-[#f2f2f2] mb-2">
            How-To Guides
          </h1>
          <p className="font-body text-lg text-[#1a1a1a]/70 dark:text-[#f2f2f2]/70">
            Learn how to use the platform and complete tasks
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#1a1a1a]/50 dark:text-[#f2f2f2]/50 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search guides..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 font-body"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="all" className="font-button">All</TabsTrigger>
            <TabsTrigger value="getting-started" className="font-button">Getting Started</TabsTrigger>
            <TabsTrigger value="projects" className="font-button">Projects</TabsTrigger>
            <TabsTrigger value="feedback" className="font-button">Feedback</TabsTrigger>
            <TabsTrigger value="settings" className="font-button">Settings</TabsTrigger>
            <TabsTrigger value="advanced" className="font-button">Advanced</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Guides Grid */}
        <div className="grid grid-cols-1 gap-8 mb-12">
          {filteredGuides.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="font-body text-[#1a1a1a]/60 dark:text-[#f2f2f2]/60">
                  No guides found matching your criteria.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredGuides.map((guide) => (
              <Card key={guide.id} className="overflow-hidden">
                <CardHeader className="border-b border-[#1a1a1a]/10 dark:border-[#f2f2f2]/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-heading text-2xl mb-2">{guide.title}</CardTitle>
                      <Badge variant="outline" className="font-body">
                        {guide.category.replace('-', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Video Container */}
                  <div className="relative bg-[#1a1a1a] aspect-video">
                    {guide.videoUrl ? (
                      <iframe
                        src={guide.videoUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PlayCircle className="w-16 h-16 text-white/50" />
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="font-heading text-lg font-semibold mb-2">Description</h3>
                      <p className="font-body text-[#1a1a1a]/70 dark:text-[#f2f2f2]/70">
                        {guide.description}
                      </p>
                    </div>
                    <div>
                      <h3 className="font-heading text-lg font-semibold mb-2">Step-by-Step Instructions</h3>
                      <div
                        className="font-body text-[#1a1a1a]/70 dark:text-[#f2f2f2]/70 prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: guide.instructions }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Still Have Questions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">Still have questions?</CardTitle>
          </CardHeader>
          <CardContent>
            {showSuccess && (
              <div className="mb-4 p-4 bg-[#0A7968]/10 border border-[#0A7968] rounded text-[#0A7968] font-body">
                Your question has been submitted! We'll get back to you soon.
              </div>
            )}
            <form onSubmit={handleQuestionSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="question-name" className="font-body">Your Name</Label>
                  <Input
                    id="question-name"
                    type="text"
                    value={questionName}
                    onChange={(e) => setQuestionName(e.target.value)}
                    required
                    className="font-body"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-email" className="font-body">Your Email</Label>
                  <Input
                    id="question-email"
                    type="email"
                    value={questionEmail}
                    onChange={(e) => setQuestionEmail(e.target.value)}
                    required
                    className="font-body"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="question-message" className="font-body">Your Question</Label>
                <Textarea
                  id="question-message"
                  value={questionMessage}
                  onChange={(e) => setQuestionMessage(e.target.value)}
                  rows={6}
                  placeholder="Describe your question in detail..."
                  required
                  className="font-body"
                />
              </div>
              <Button type="submit" className="font-button bg-[#0abab5] hover:bg-[#0abab5]/90 text-white">
                Submit Question
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
