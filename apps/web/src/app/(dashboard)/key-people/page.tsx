"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import AsyncSelect from 'react-select/async';
import { StylesConfig, GroupBase, OptionsOrGroups, MenuPlacement, MenuPosition } from 'react-select';
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UsersIcon, AlertCircle, UserIcon, Edit, Loader2, Sparkles, Search, MessageSquare, Trash2 } from "lucide-react";

interface Stakeholder {
  role: string;
  slack_user_id: string;
  full_name?: string | null;
}

interface StakeholdersData {
  [key: string]: string; // PM: ID, SalesRep1: ID, etc.
}

interface FetchedStakeholder extends Stakeholder {
  displayRole: string;
}

interface SlackUser {
  id: string;
  name: string;
}

interface SelectOption {
  value: string;
  label: string;
}

// Schema for the edit form
const formSchema = z.object({
  stakeholders: z.array(z.object({
    role: z.string().min(1, "Role cannot be empty"),
    displayRole: z.string().min(1, "Display Role cannot be empty"),
    slack_user_id: z.string().min(1, "Slack user must be selected"),
    full_name: z.string().min(1, "Full name is required"),
  }))
});
type FormData = z.infer<typeof formSchema>;

// Mapping and helper functions
const stakeholderLabels: Record<string, string> = {
  PM: "Project Manager",
  SalesRep1: "Sales Representative (Primary)",
  SalesRep2: "Sales Representative (Secondary)"
};

function parseAgentResult(result: string): { role: string, name: string }[] {
  const people: { role: string, name: string }[] = [];
  const lines = result.split(/\n|,/).map(line => line.trim()).filter(Boolean);
  
  lines.forEach(line => {
    const match = line.match(/(.*?)\s*\((.*?)\)/); // Matches "Name (Role)"
    if (match) {
      const name = match[1].trim();
      let role = match[2].trim();
      // Simple heuristic to map common roles back to keys if possible
      const roleKey = Object.keys(stakeholderLabels).find(key => 
        stakeholderLabels[key].toLowerCase().includes(role.toLowerCase())
      );
      people.push({ name, role: roleKey || role }); // Use mapped key or original role
    } else {
      // Fallback: assume Name only
      const name = line;
      let role = 'Other'; // Assign generic role
      // Try to fill known roles if empty
      if (!people.some(p => p.role === 'PM')) role = 'PM';
      else if (!people.some(p => p.role === 'SalesRep1')) role = 'SalesRep1';
      else if (!people.some(p => p.role === 'SalesRep2')) role = 'SalesRep2';
      people.push({ name, role });
    }
  });
  return people;
}

// React Select styles sensitive to theme
const getSelectStyles = (theme: string | undefined): StylesConfig<SelectOption, false> => ({
  control: (provided, state) => ({
    ...provided,
    backgroundColor: theme === 'dark' ? 'hsl(var(--input))' : 'white',
    borderColor: state.isFocused ? 'hsl(var(--ring))' : theme === 'dark' ? 'hsl(var(--input))' : 'hsl(var(--border))',
    color: 'hsl(var(--foreground))',
    minHeight: '36px',
    height: '36px',
    boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
    borderRadius: 'calc(var(--radius) - 2px)',
    '&:hover': {
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
    }
  }),
  input: (provided) => ({
    ...provided,
    color: 'hsl(var(--foreground))',
    margin: '0px',
    paddingBottom: '0px',
    paddingTop: '0px',
  }),
  valueContainer: (provided) => ({
    ...provided,
    height: '36px',
    padding: '0 8px' // Increased horizontal padding
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    height: '36px'
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: theme === 'dark' ? 'hsl(var(--popover))' : 'white',
    borderColor: theme === 'dark' ? 'hsl(var(--input))' : 'hsl(var(--border))',
    borderWidth: '1px',
    borderRadius: 'var(--radius)',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    zIndex: 9999 // Ensure menu is above dialog content
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }), // Style for portal
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? 'hsl(var(--primary))'
      : state.isFocused
      ? theme === 'dark' ? 'hsl(var(--accent))' : 'hsl(var(--accent))'
      : 'transparent',
    color: state.isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
    padding: '8px 12px', // Adjust padding
    cursor: 'pointer',
    '&:active': {
      backgroundColor: !state.isDisabled ? (state.isSelected ? undefined : 'hsl(var(--primary)/0.9)') : undefined
    }
  }),
  placeholder: (provided) => ({
      ...provided,
      color: 'hsl(var(--muted-foreground))' // Style placeholder text
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'hsl(var(--foreground))',
  }),
  dropdownIndicator: (provided) => ({
      ...provided,
      padding: '4px',
      color: 'hsl(var(--muted-foreground))',
      '&:hover': {
          color: 'hsl(var(--foreground))'
      }
  }),
  clearIndicator: (provided) => ({
      ...provided,
      padding: '4px',
      color: 'hsl(var(--muted-foreground))',
       '&:hover': {
          color: 'hsl(var(--destructive))'
      }
  })
});

// Debounced Slack user search function
let debounceTimer: NodeJS.Timeout | null = null;
const loadSlackUsers = (inputValue: string, callback: (options: OptionsOrGroups<SelectOption, GroupBase<SelectOption>>) => void) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  if (!inputValue || inputValue.length < 2) {
    callback([]);
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      const response = await fetch(`/api/slack/search-user?name=${encodeURIComponent(inputValue)}`);
      const data = await response.json();
      const options: SelectOption[] = data.users ? data.users.map((user: SlackUser) => ({ value: user.id, label: user.name })) : [];
      callback(options);
    } catch (error) {
      console.error("Slack search failed:", error);
      callback([]);
    }
  }, 350); // 350ms debounce
};

// The main page component
export default function KeyPeoplePage() {
  const { theme } = useTheme();
  const selectStyles = useMemo(() => getSelectStyles(theme), [theme]);
  const [stakeholders, setStakeholders] = useState<FetchedStakeholder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Store default options for Select inputs to show initial value
  const [defaultSelectOptions, setDefaultSelectOptions] = useState<Record<number, SelectOption>>({});

  const { 
    control, 
    handleSubmit, 
    reset, 
    setValue, // Need setValue to update full_name when select changes
    formState: { errors, isDirty } 
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { stakeholders: [] }
  });
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "stakeholders"
  });

  const fetchStakeholdersData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/deals/stakeholders');
      if (!response.ok) throw new Error('Failed to fetch stakeholders data');
      const data: StakeholdersData = await response.json();
      
      // In a real app, fetch full names if available, here we just use ID as placeholder
      const displayData: FetchedStakeholder[] = Object.entries(data).map(([role, slack_user_id]) => ({
        role,
        displayRole: stakeholderLabels[role] || role,
        slack_user_id,
        full_name: slack_user_id // Use ID as placeholder full name initially
      }));
      setStakeholders(displayData);
      
      // Prepare initial form data and default options for selects
      const initialFormValues = displayData.map(s => ({ 
        ...s, 
        full_name: s.full_name || '' 
      }));
      reset({ stakeholders: initialFormValues });

      const initialOptions: Record<number, SelectOption> = {};
      initialFormValues.forEach((s, index) => {
        if (s.slack_user_id && s.full_name) {
          initialOptions[index] = { value: s.slack_user_id, label: s.full_name };
        }
      });
      setDefaultSelectOptions(initialOptions);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchStakeholdersData();
  }, [fetchStakeholdersData]);

  const handleIdentifyPeople = async () => {
    setIsIdentifying(true);
    try {
      const dummyContext = { dealId: "DEAL123", s3Keys: [] }; 
      const response = await fetch('/api/agent/get-key-people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dummyContext)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Agent failed');

      const parsedPeople = parseAgentResult(result.result);
      if (parsedPeople.length === 0) {
        toast.info("AI couldn't identify specific people. Please add manually.");
        setIsIdentifying(false);
        return;
      }

      toast.info("AI identified people. Searching Slack users...");

      const searchPromises = parsedPeople.map(async (person) => {
        try {
          const searchRes = await fetch(`/api/slack/search-user?name=${encodeURIComponent(person.name)}`);
          const searchData = await searchRes.json();
          const foundUser = searchData.users?.[0]; // Take the first match
          return {
            role: person.role,
            displayRole: stakeholderLabels[person.role] || person.role,
            slack_user_id: foundUser?.id || '',
            full_name: person.name,
            selectOption: foundUser ? { value: foundUser.id, label: foundUser.name } : null
          };
        } catch {
          return {
            role: person.role,
            displayRole: stakeholderLabels[person.role] || person.role,
            slack_user_id: '',
            full_name: person.name,
            selectOption: null
          };
        }
      });

      const identifiedStakeholders = await Promise.all(searchPromises);
      
      // Replace form fields and update default select options
      const newFormValues = identifiedStakeholders.map(s => ({ 
        role: s.role, 
        displayRole: s.displayRole, 
        slack_user_id: s.slack_user_id, 
        full_name: s.full_name
      }));
      replace(newFormValues);

      const newOptions: Record<number, SelectOption> = {};
      identifiedStakeholders.forEach((s, index) => {
        if (s.selectOption) {
          newOptions[index] = s.selectOption;
        }
      });
      setDefaultSelectOptions(newOptions);

      toast.success("AI results loaded! Please review and assign Slack users.");

    } catch (error) {
      toast.error(`Failed to identify people: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsIdentifying(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSaving(true);
    try {
      const payload = {
        mappings: data.stakeholders.map(s => ({ 
          role: s.role, 
          slack_user_id: s.slack_user_id, 
          full_name: s.full_name 
        }))
      };
      const response = await fetch('/api/deals/stakeholders/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || result.error || result.details || 'Failed to save mappings');
      }

      toast.success("Stakeholder mappings saved successfully!");
      setIsEditDialogOpen(false);
      fetchStakeholdersData(); // Refresh the displayed list

    } catch (error) {
      toast.error(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  // --- RENDER LOGIC --- //

  if (loading && !stakeholders) { // Initial load skeleton
    return (
      <div className="space-y-6">
        <header className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </header>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
            <div className="pt-4">
              <Skeleton className="h-10 w-24 ml-auto" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <header className="mb-8">
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Key People</h1>
          </div>
          <p className="text-muted-foreground mt-2">
            View and manage the key stakeholders involved in your deals
          </p>
        </motion.div>
      </header>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Stakeholders</CardTitle>
              <CardDescription>
                People responsible for managing and executing deals
              </CardDescription>
            </div>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Stakeholders
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-5xl w-full max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Edit Stakeholders</DialogTitle>
                  <DialogDescription>
                    Assign Slack users to stakeholder roles. Use the magic wand to let AI identify them first!
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden space-y-4">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-3 -mr-3 pl-1 -ml-1 py-2">
                    {fields.map((field, index) => (
                      <Card key={field.id}>
                        <CardContent className="grid grid-cols-[1fr_1fr_1.5fr_auto] items-center gap-3 p-3">
                          <div className="space-y-1">
                            <Label htmlFor={`stakeholders.${index}.role`} className="text-xs">Role</Label>
                            <Input 
                              id={`stakeholders.${index}.displayRole`} 
                              value={field.displayRole} 
                              className="font-medium bg-muted h-9 text-sm" 
                              readOnly 
                            />
                            <Controller
                              name={`stakeholders.${index}.role`}
                              control={control}
                              render={({ field }) => <input type="hidden" {...field} />}
                            />
                            {errors.stakeholders?.[index]?.role && <p className="text-xs text-destructive">{errors.stakeholders[index]?.role?.message}</p>}
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor={`stakeholders.${index}.fullName`} className="text-xs">Full Name</Label>
                            <Controller
                                name={`stakeholders.${index}.full_name`}
                                control={control}
                                render={({ field }) => (
                                  <Input id={`stakeholders.${index}.fullName`} {...field} placeholder="Full Name" className="h-9 text-sm" />
                                )}
                            />
                             {errors.stakeholders?.[index]?.full_name && <p className="text-xs text-destructive">{errors.stakeholders[index]?.full_name?.message}</p>}
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor={`stakeholders.${index}.slackUser`} className="text-xs">Slack User</Label>
                             <Controller
                                name={`stakeholders.${index}.slack_user_id`}
                                control={control}
                                render={({ field: { onChange, value, name } }) => (
                                  <AsyncSelect<SelectOption, false>
                                    inputId={`stakeholders.${index}.slackUser`}
                                    name={name}
                                    styles={selectStyles}
                                    menuPlacement="auto"
                                    menuPosition="fixed"
                                    menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
                                    placeholder="Search Slack User..."
                                    loadOptions={loadSlackUsers}
                                    value={defaultSelectOptions[index] && defaultSelectOptions[index].value === value ? defaultSelectOptions[index] : null}
                                    onChange={(selectedOption: SelectOption | null) => {
                                        const newSlackId = selectedOption ? selectedOption.value : '';
                                        const newFullName = selectedOption ? selectedOption.label : '';
                                        onChange(newSlackId);
                                        setValue(`stakeholders.${index}.full_name`, newFullName, { shouldDirty: true });
                                        setDefaultSelectOptions(prev => ({ ...prev, [index]: selectedOption || { value: '', label: '' } }));
                                    }}
                                    isClearable
                                    cacheOptions
                                    defaultOptions
                                  />
                                )}
                            />
                            {errors.stakeholders?.[index]?.slack_user_id && <p className="text-xs text-destructive">{errors.stakeholders[index]?.slack_user_id?.message}</p>}
                          </div>
                          
                          <Button variant="ghost" size="icon" type="button" onClick={() => remove(index)} className="h-9 w-9">
                              <Trash2 className="h-4 w-4 text-destructive"/>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <Button type="button" variant="outline" onClick={handleIdentifyPeople} disabled={isIdentifying}>
                      {isIdentifying ? 
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                        <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
                      }
                      AI Identify People
                    </Button>
                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isSaving || !isDirty}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : stakeholders && stakeholders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Slack User</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stakeholders.map((stakeholder) => (
                    <TableRow key={stakeholder.role}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        {stakeholder.displayRole}
                      </TableCell>
                      <TableCell>
                        {stakeholder.slack_user_id ? (
                          <Badge variant="secondary" className="font-mono">
                            {stakeholder.full_name || stakeholder.slack_user_id} ({stakeholder.slack_user_id})
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not Assigned</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline"
                          size="sm"
                          disabled={!stakeholder.slack_user_id}
                          onClick={() => window.open(`slack://user?id=${stakeholder.slack_user_id}`, '_blank')}
                        >
                          <MessageSquare className="mr-2 h-3 w-3" />
                          Message
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Alert variant="default" className="text-center">
                <AlertTitle className="text-center">No stakeholders found</AlertTitle>
                <AlertDescription>
                  No stakeholders assigned yet. Use the Edit button to assign them.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
} 