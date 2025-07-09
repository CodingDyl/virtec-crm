'use client'

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';

interface Subscriber {
  id: string;
  name: string;
  email: string;
  dateSubscribed: any; // Firestore Timestamp
  unsubscribed: boolean;
}

export default function Subscriptions() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscribers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "subscribers"));
      const subscribersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subscriber[];
      setSubscribers(subscribersData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const handleBroadcastEmail = () => {
    // Add your broadcast email functionality here
    console.log("Broadcast email to active subscribers");
  };

  return (
    <Card className="bg-space2 border-spaceAccent">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-spaceText">Subscribers Overview</CardTitle>
            <CardDescription className="text-spaceAccent">
              Manage newsletter subscribers and their subscription status
            </CardDescription>
          </div>
          <Button 
            onClick={handleBroadcastEmail}
            className="bg-spaceAccent hover:bg-spaceAlt text-spaceText"
          >
            Send Broadcast Email
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="min-h-[500px] w-full flex flex-col items-center justify-center p-8 gap-4">
            <Quantum
              size="100"
              speed="1.75"
              color="white" 
            />
            <p className="text-spaceText">Fetching subscribers...</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-spaceAlt">Name</TableHead>
                <TableHead className="text-spaceAlt">Email</TableHead>
                <TableHead className="text-spaceAlt">Date Subscribed</TableHead>
                <TableHead className="text-spaceAlt">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell className="text-spaceText">{subscriber.name}</TableCell>
                  <TableCell className="text-spaceText">{subscriber.email}</TableCell>
                  <TableCell className="text-spaceText">
                    {format(subscriber.dateSubscribed.toDate(), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    <Badge variant={subscriber.unsubscribed ? 'secondary' : 'default'}>
                      {subscriber.unsubscribed ? 'Unsubscribed' : 'Active'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
