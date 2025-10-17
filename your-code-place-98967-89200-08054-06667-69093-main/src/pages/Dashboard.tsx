import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Link as LinkIcon, FileArchive, Folder, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { WizardStep } from "@/components/wizard/WizardStep";
import { useGitHubRepos } from "@/hooks/useGitHubRepos";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { TutorialOverlay } from "@/components/onboarding/TutorialOverlay";
import JSZip from "jszip";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Step 1: Destination choice
  const [destinationType, setDestinationType] = useState<"new" | "existing">("new");
  
  // Step 2: Repository & Branch
  const [repoName, setRepoName] = useState("");
  const [repoNameValidation, setRepoNameValidation] = useState<"checking" | "available" | "taken" | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [targetBranch, setTargetBranch] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [useExistingBranch, setUseExistingBranch] = useState(true);
  
  // Step 3: Content & Mode
  const [importMode, setImportMode] = useState("add");
  const [importUrl, setImportUrl] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>({});
  const [uploadType, setUploadType] = useState<"folder" | "zip" | "url">("folder");
  const [zipFileName, setZipFileName] = useState<string>("");
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Onboarding state
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  const { repos, branches, loadingRepos, loadingBranches, fetchRepos, fetchBranches } = useGitHubRepos();

  const steps = ["Choose Destination", "Configure Branch", "Select Content", "Review & Push"];

  // Check if user has seen onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("repopush_onboarding_completed");
    if (!hasSeenOnboarding && profileLoaded) {
      setShowWelcome(true);
    }
  }, [profileLoaded]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      } else if (session) {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string, retryCount = 0) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("github_username, github_access_token")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setUsername(data.github_username);
      
      // Check if token exists
      if (data.github_access_token) {
        console.log('Profile loaded with valid GitHub token');
        setProfileLoaded(true);
      } else if (retryCount < 3) {
        // Token not saved yet, retry after 1 second
        console.log(`GitHub token not ready, retrying... (${retryCount + 1}/3)`);
        setTimeout(() => fetchProfile(userId, retryCount + 1), 1000);
      } else {
        // After 3 retries, show error
        toast({
          variant: "destructive",
          title: "Setup Incomplete",
          description: "Your GitHub connection isn't ready yet. Please try logging out and back in.",
        });
      }
    }
  };

  // Load repos when choosing existing repository
  useEffect(() => {
    if (destinationType === "existing" && currentStep === 0) {
      fetchRepos();
    }
  }, [destinationType, currentStep]);

  // Load branches when repository is selected
  useEffect(() => {
    if (selectedRepo && currentStep === 1) {
      fetchBranches(selectedRepo);
    }
  }, [selectedRepo, currentStep]);

  const checkRepoName = async (retryCount: number) => {
    setRepoNameValidation("checking");
    try {
      const { data, error } = await supabase.functions.invoke('check-repo-name', {
        body: { repositoryName: repoName.trim() }
      });
      
      if (error) throw error;
      if (data?.error) {
        // If 401 and token not ready, retry up to 2 times
        if (data.errorCode === 'TOKEN_NOT_READY' && retryCount < 2) {
          console.log(`Token not ready, retrying... (${retryCount + 1}/2)`);
          setTimeout(() => checkRepoName(retryCount + 1), 2000);
          return;
        }
        throw new Error(data.error);
      }
      
      setRepoNameValidation(data.available ? "available" : "taken");
    } catch (error: any) {
      console.error('Error checking repo name:', error);
      setRepoNameValidation(null);
      toast({
        variant: "destructive",
        title: "Connection Issue",
        description: "Please wait a moment while we set up your account.",
      });
    }
  };

  // Check repository name availability
  useEffect(() => {
    if (destinationType === "new" && repoName.trim() && currentStep === 0 && profileLoaded) {
      const timer = setTimeout(async () => {
        await checkRepoName(0);
      }, 800);
      
      return () => clearTimeout(timer);
    } else {
      setRepoNameValidation(null);
    }
  }, [repoName, destinationType, currentStep, profileLoaded]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileMap: Record<string, string> = {};
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text();
      const path = (file as any).webkitRelativePath || file.name;
      fileMap[path] = content;
    }

    setSelectedFiles(fileMap);
    toast({
      title: "Files loaded",
      description: `${Object.keys(fileMap).length} files ready to upload`,
    });
  };

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setZipFileName(file.name);

    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      const fileMap: Record<string, string> = {};

      const filePromises: Promise<void>[] = [];
      zipContent.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          filePromises.push(
            zipEntry.async("text").then((content) => {
              fileMap[relativePath] = content;
            })
          );
        }
      });

      await Promise.all(filePromises);
      setSelectedFiles(fileMap);

      toast({
        title: "ZIP file extracted",
        description: `${Object.keys(fileMap).length} files ready to upload`,
      });
    } catch (error) {
      console.error('Error extracting ZIP:', error);
      toast({
        variant: "destructive",
        title: "Failed to extract ZIP",
        description: "Please ensure the file is a valid ZIP archive",
      });
    }
  };

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (destinationType === "new") {
          return repoName.trim() !== "" && repoNameValidation === "available";
        }
        return selectedRepo !== "";
      case 2:
        return useExistingBranch ? targetBranch !== "" : newBranchName.trim() !== "";
      case 3:
        if (uploadType === "url") return importUrl.trim() !== "";
        return Object.keys(selectedFiles).length > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1 && canProceedToStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePush = async () => {
    if (isLoading) return; // Prevent duplicate calls
    
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: "destructive",
          title: "Not authenticated",
          description: "Please log in again",
        });
        setIsLoading(false);
        return;
      }

      const finalRepoName = destinationType === "new" ? repoName : selectedRepo;
      const finalBranch = useExistingBranch ? targetBranch : newBranchName;

      if (!finalRepoName || !finalBranch) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please ensure repository and branch are selected",
        });
        setIsLoading(false);
        return;
      }

      const payload: any = {
        repositoryName: finalRepoName,
        importMode,
        targetBranch: finalBranch,
      };

      if (uploadType === "folder" || uploadType === "zip") {
        if (Object.keys(selectedFiles).length === 0) {
          toast({
            variant: "destructive",
            title: "No files selected",
            description: "Please select files to upload",
          });
          setIsLoading(false);
          return;
        }
        payload.fileMap = selectedFiles;
      } else if (uploadType === "url") {
        if (!importUrl.trim()) {
          toast({
            variant: "destructive",
            title: "No URL provided",
            description: "Please enter a GitHub URL",
          });
          setIsLoading(false);
          return;
        }
        payload.githubUrl = importUrl;
      }

      const { data, error } = await supabase.functions.invoke('create-and-push-repo', {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('token') || data.error.includes('expired')) {
          throw new Error('Your GitHub session has expired. Please log out and log back in.');
        }
        throw new Error(data.error);
      }

      toast({
        title: "Success!",
        description: `Files pushed to ${finalBranch} branch successfully`,
      });

      // Reset and redirect
      setTimeout(() => navigate("/repositories"), 1500);

    } catch (error: any) {
      console.error('Error pushing to repository:', error);
      toast({
        variant: "destructive",
        title: "Failed to push",
        description: error.message || "Unable to push files. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header username={username} showNav={true} />
      
      <WelcomeModal 
        open={showWelcome}
        onOpenChange={setShowWelcome}
        onStartTutorial={() => {
          setShowWelcome(false);
          localStorage.setItem("repopush_onboarding_completed", "true");
          sessionStorage.setItem("start_tutorial", "true");
          // Navigate to repositories page for tutorial
          navigate("/repositories");
        }}
      />
      
      <TutorialOverlay 
        isActive={showTutorial}
        onComplete={() => setShowTutorial(false)}
      />
      
      <main className="container mx-auto px-4 py-8" data-tutorial="dashboard">
        <div className="max-w-4xl mx-auto space-y-6">
          {username && (
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">
                Welcome, <span className="bg-gradient-primary bg-clip-text text-transparent">{username}</span>!
              </h2>
              <p className="text-muted-foreground">Guided Push Wizard</p>
            </div>
          )}

          <Card className="shadow-elevated gradient-card">
            <CardHeader>
              <CardTitle>Push to GitHub</CardTitle>
              <CardDescription>
                Follow the wizard to push your files to a repository
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <StepIndicator steps={steps} currentStep={currentStep} />

              {/* Step 1: Choose Destination */}
              <WizardStep isActive={currentStep === 0} isCompleted={currentStep > 0}>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Choose Your Destination</h3>
                    <RadioGroup value={destinationType} onValueChange={(v: any) => setDestinationType(v)}>
                      <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-secondary/50 transition-smooth cursor-pointer">
                        <RadioGroupItem value="new" id="new" />
                        <Label htmlFor="new" className="font-normal cursor-pointer flex-1">
                          Create a New Repository
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-secondary/50 transition-smooth cursor-pointer">
                        <RadioGroupItem value="existing" id="existing" />
                        <Label htmlFor="existing" className="font-normal cursor-pointer flex-1">
                          Push to an Existing Repository
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {destinationType === "new" ? (
                    <div className="space-y-2">
                      <Label htmlFor="repoName">Repository Name</Label>
                      <Input
                        id="repoName"
                        placeholder="my-awesome-project"
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value)}
                        disabled={!profileLoaded}
                        className="bg-secondary"
                      />
                      {!profileLoaded && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Setting up your GitHub connection...
                        </p>
                      )}
                      {repoNameValidation === "checking" && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Checking availability...
                        </p>
                      )}
                      {repoNameValidation === "available" && (
                        <p className="text-sm text-green-600 dark:text-green-400">
                          ✓ Repository name is available
                        </p>
                      )}
                      {repoNameValidation === "taken" && (
                        <p className="text-sm text-destructive">
                          ✗ Repository name already exists
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="selectRepo">Select Repository</Label>
                      <Select value={selectedRepo} onValueChange={setSelectedRepo} disabled={loadingRepos}>
                        <SelectTrigger className="bg-secondary">
                          <SelectValue placeholder={loadingRepos ? "Loading repositories..." : "Choose a repository"} />
                        </SelectTrigger>
                        <SelectContent>
                          {repos.map((repo) => (
                            <SelectItem key={repo.name} value={repo.name}>
                              {repo.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </WizardStep>

              {/* Step 2: Configure Branch */}
              <WizardStep isActive={currentStep === 1} isCompleted={currentStep > 1}>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Configure Target Branch</h3>
                    <RadioGroup value={useExistingBranch ? "existing" : "new"} onValueChange={(v) => setUseExistingBranch(v === "existing")}>
                      <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-secondary/50 transition-smooth cursor-pointer">
                        <RadioGroupItem value="existing" id="existing-branch" />
                        <Label htmlFor="existing-branch" className="font-normal cursor-pointer flex-1">
                          Use Existing Branch
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-secondary/50 transition-smooth cursor-pointer">
                        <RadioGroupItem value="new" id="new-branch" />
                        <Label htmlFor="new-branch" className="font-normal cursor-pointer flex-1">
                          Create New Branch
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {useExistingBranch ? (
                    <div className="space-y-2">
                      <Label htmlFor="branch">Target Branch</Label>
                      <Select value={targetBranch} onValueChange={setTargetBranch} disabled={loadingBranches}>
                        <SelectTrigger className="bg-secondary">
                          <SelectValue placeholder={loadingBranches ? "Loading branches..." : "Select branch"} />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.name} value={branch.name}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="newBranch">New Branch Name</Label>
                      <Input
                        id="newBranch"
                        placeholder="feature-branch-name"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        className="bg-secondary"
                      />
                    </div>
                  )}
                </div>
              </WizardStep>

              {/* Step 3: Select Content */}
              <WizardStep isActive={currentStep === 2} isCompleted={currentStep > 2}>
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Select Content to Push</h3>
                  
                  <Tabs defaultValue="folder" className="w-full" onValueChange={(v) => setUploadType(v as any)}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="folder">
                        <Folder className="h-4 w-4 mr-2" />
                        Folder
                      </TabsTrigger>
                      <TabsTrigger value="zip">
                        <FileArchive className="h-4 w-4 mr-2" />
                        ZIP File
                      </TabsTrigger>
                      <TabsTrigger value="url">
                        <LinkIcon className="h-4 w-4 mr-2" />
                        GitHub URL
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="folder" className="space-y-4">
                      <label htmlFor="folder-input" className="block">
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-smooth cursor-pointer bg-secondary/50">
                          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Click to select a folder
                          </p>
                          {Object.keys(selectedFiles).length > 0 && (
                            <p className="text-sm text-primary font-medium">
                              {Object.keys(selectedFiles).length} files selected
                            </p>
                          )}
                        </div>
                        <input 
                          id="folder-input"
                          type="file" 
                          className="hidden" 
                          onChange={handleFileSelect}
                          {...({ webkitdirectory: "", directory: "" } as any)} 
                        />
                      </label>
                    </TabsContent>

                    <TabsContent value="zip" className="space-y-4">
                      <label htmlFor="zip-input" className="block">
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-smooth cursor-pointer bg-secondary/50">
                          <FileArchive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Click to select a ZIP file
                          </p>
                          {zipFileName && (
                            <p className="text-sm text-primary font-medium">
                              {zipFileName} ({Object.keys(selectedFiles).length} files)
                            </p>
                          )}
                        </div>
                        <input 
                          id="zip-input"
                          type="file" 
                          accept=".zip" 
                          className="hidden"
                          onChange={handleZipSelect}
                        />
                      </label>
                    </TabsContent>

                    <TabsContent value="url" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="importUrl">GitHub Repository URL</Label>
                        <Input
                          id="importUrl"
                          type="url"
                          placeholder="https://github.com/username/repository"
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          className="bg-secondary"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="space-y-3">
                    <Label>Import Mode</Label>
                    <RadioGroup value={importMode} onValueChange={setImportMode}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="add" id="add" />
                        <Label htmlFor="add" className="font-normal cursor-pointer">
                          Add to branch (preserve existing files)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="overwrite" id="overwrite" />
                        <Label htmlFor="overwrite" className="font-normal cursor-pointer">
                          Overwrite branch content
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </WizardStep>

              {/* Step 4: Review & Push */}
              <WizardStep isActive={currentStep === 3} isCompleted={false}>
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Review & Confirm</h3>
                  
                  <div className="bg-secondary/50 p-6 rounded-lg space-y-3">
                    <p className="text-sm">
                      <span className="font-medium">Repository:</span>{" "}
                      <span className="text-primary">{destinationType === "new" ? repoName : selectedRepo}</span>
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Target Branch:</span>{" "}
                      <span className="text-primary">{useExistingBranch ? targetBranch : newBranchName}</span>
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Content:</span>{" "}
                      {uploadType === "url" ? importUrl : `${Object.keys(selectedFiles).length} files`}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Mode:</span>{" "}
                      {importMode === "add" ? "Add to branch" : "Overwrite branch"}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    You are about to push the selected content to the{" "}
                    <strong>{useExistingBranch ? targetBranch : newBranchName}</strong> branch in{" "}
                    <strong>{destinationType === "new" ? repoName : selectedRepo}</strong>. Proceed?
                  </p>
                </div>
              </WizardStep>

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0 || isLoading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>

                {currentStep < steps.length - 1 ? (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceedToStep(currentStep + 1)}
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handlePush}
                    disabled={isLoading}
                    className="transition-smooth hover:shadow-glow"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Pushing...
                      </>
                    ) : (
                      "Create & Push"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
