'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLoading } from '@/app/providers/LoadingProvider';

interface NavigationLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  [key: string]: any;
}

export default function NavigationLink({ 
  href, 
  children, 
  className, 
  onClick,
  ...props 
}: NavigationLinkProps) {
  const router = useRouter();
  const { startLoading } = useLoading();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    // Start loading animation immediately
    startLoading(href);
    
    // Call optional onClick handler
    onClick?.();
    
    // Navigate after a tiny delay to ensure animation starts
    setTimeout(() => {
      router.push(href);
    }, 10);
  };

  return (
    <Link
      href={href}
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
}