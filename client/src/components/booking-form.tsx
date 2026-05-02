import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, Phone, CalendarCheck, Star, MessageCircle, Scissors, Camera, Upload } from "lucide-react";
import { SuccessModal } from "@/components/success-modal";
import { CalendarView } from "@/components/calendar-view";
import { SimpleTimeSelector } from "@/components/simple-time-selector";
import { BarberProfile } from "@/components/barber-profile";
import { ProgressIndicator } from "@/components/progress-indicator";
import { useToast } from "@/hooks/use-toast";
import type { Barber, Service } from "@shared/schema";

const bookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerPhone: z.string().min(10, "Please enter a valid phone number"),
  customerEmail: z.string().email("Please enter a valid email").optional(),
  barberId: z.number().min(1, "Please select a barber"),
  serviceId: z.number().min(1, "Please select a service"),
  date: z.string().min(1, "Please select a date"),
  time: z.string().min(1, "Please select a time"),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  onBookingComplete?: (result: { aiMessage?: string }) => void;
}

export function BookingForm({ onBookingComplete }: BookingFormProps) {
  const [selectedBarber, setSelectedBarber] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      barberId: 0,
      serviceId: 0,
      date: "",
      time: "",
    },
  });

  // Fetch barbers
  const { data: barbers = [] } = useQuery({
    queryKey: ["/api/barbers"],
    queryFn: api.getBarbers,
  });

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ["/api/services"],
    queryFn: api.getServices,
  });

  // Fetch available time slots
  const { data: availableSlots = [] } = useQuery({
    queryKey: ["/api/availability", selectedBarber, selectedDate],
    queryFn: () => api.getAvailability(selectedBarber!, selectedDate),
    enabled: !!selectedBarber && !!selectedDate,
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: api.createBooking,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/availability"] });

      const selectedBarberData = barbers.find(b => b.id === data.barberId);
      const selectedServiceData = services.find(s => s.id === data.serviceId);

      setBookingDetails({
        ...data,
        barberName: selectedBarberData?.name || "",
        serviceName: selectedServiceData?.name || "",
        servicePrice: selectedServiceData?.price || 0,
      });
      setShowSuccessModal(true);

      // Call the callback with AI message if provided
      if (onBookingComplete && (data as any).aiMessage) {
        onBookingComplete({ aiMessage: (data as any).aiMessage });
      }

      form.reset();
      setSelectedBarber(null);
      setSelectedDate("");
      setSelectedTime("");
      setSelectedService(null);
    },
    onError: (error: any) => {
      toast({
        title: "Booking failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BookingFormData) => {
    createBookingMutation.mutate({
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      barberId: data.barberId,
      serviceId: data.serviceId,
      date: data.date,
      time: data.time,
      status: "confirmed",
    });
  };

  // Update form when selections change
  useEffect(() => {
    if (selectedBarber) {
      form.setValue("barberId", selectedBarber);
    }
  }, [selectedBarber, form]);

  useEffect(() => {
    if (selectedDate) {
      form.setValue("date", selectedDate);
    }
  }, [selectedDate, form]);

  useEffect(() => {
    if (selectedTime) {
      form.setValue("time", selectedTime);
    }
  }, [selectedTime, form]);

  useEffect(() => {
    if (selectedService) {
      form.setValue("serviceId", selectedService);
    }
  }, [selectedService, form]);

  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0];

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatPrice = (priceInCents: number) => {
    return `£${(priceInCents / 100).toFixed(2)}`;
  };

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;
  const shopName = (import.meta.env.VITE_SHOP_NAME as string | undefined) || "Our Barbershop";
  const shopAddress = (import.meta.env.VITE_SHOP_ADDRESS as string | undefined) || "";
  const shopPhone = (import.meta.env.VITE_SHOP_PHONE as string | undefined) || "";
  const shopHoursWeekday = (import.meta.env.VITE_SHOP_HOURS_WEEKDAY as string | undefined) || "Mon-Fri: 9:00 AM - 8:00 PM";
  const shopHoursWeekend = (import.meta.env.VITE_SHOP_HOURS_WEEKEND as string | undefined) || "Sat-Sun: 9:00 AM - 6:00 PM";

  const openWhatsApp = () => {
    if (!whatsappNumber) return;
    const message = `Hi, I'd like to book an appointment at ${shopName}. Can you help me with scheduling?`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCalendarDateSelect = (date: string) => {
    setSelectedDate(date);
    form.setValue("date", date);
  };

  const handleQuickBook = (date: string, time?: string, barberId?: number) => {
    // Auto-fill form with calendar selection
    form.setValue("date", date);
    setSelectedDate(date);

    if (time) {
      form.setValue("time", time);
      setSelectedTime(time);
    }

    if (barberId) {
      setSelectedBarber(barberId);
      form.setValue("barberId", barberId);
    }

    // Scroll to booking form
    setTimeout(() => {
      const bookingFormElement = document.querySelector('[data-booking-form]');
      if (bookingFormElement) {
        bookingFormElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    form.setValue("time", time);
    
    // Scroll to service section immediately
    setTimeout(() => {
      const serviceSection = document.getElementById('service-selection');
      if (serviceSection) {
        serviceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        serviceSection.style.border = '3px solid #14b8a6';
        serviceSection.style.borderRadius = '8px';
        setTimeout(() => {
          serviceSection.style.border = '';
          serviceSection.style.borderRadius = '';
        }, 2000);
      }
    }, 100);
  };

  return (
    <div className="space-y-8">
      {/* Calendar Overview */}
      <CalendarView 
        onDateSelect={handleCalendarDateSelect}
        selectedBarber={selectedBarber}
        onQuickBook={handleQuickBook}
        onTimeSelect={handleTimeSelect}
      />

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Booking Form */}
        <div className="lg:col-span-2 w-full max-w-full" data-booking-form>
          <Card className="shadow-xl border border-slate-200 bg-white w-full overflow-hidden relative transition-all duration-300 hover:shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-slate-50 border-b border-slate-200 rounded-t-lg py-8">
              <CardTitle className="text-2xl text-slate-800 flex items-center" id="booking-form-title">
                <CalendarCheck className="text-teal-600 mr-3 h-6 w-6" aria-hidden="true" />
                Book Your Appointment
              </CardTitle>
              <p className="text-slate-600 font-medium text-base mt-2" id="booking-form-description">
                Select your preferred barber, date, and time slot for a professional barbershop experience
              </p>
            </CardHeader>

          <CardContent className="p-8">
            <form 
              onSubmit={form.handleSubmit(onSubmit)} 
              className="space-y-8"
              aria-labelledby="booking-form-title"
              aria-describedby="booking-form-description"
              role="form"
            >
              {/* Barber Selection */}
              <fieldset className="space-y-3" data-tour="barber-selection" aria-labelledby="barber-selection-legend">
                <legend id="barber-selection-legend" className="text-lg font-semibold text-slate-800 flex items-center">
                  <User className="text-teal-600 mr-3 w-5 h-5" aria-hidden="true" />
                  Choose Your Barber
                </legend>
                <div className="grid grid-cols-1 gap-3">
                  {barbers.map((barber) => (
                    <div key={barber.id} className="relative">
                      <input
                        type="radio"
                        id={`barber-${barber.id}`}
                        name="barber"
                        value={barber.id}
                        className="sr-only peer"
                        checked={selectedBarber === barber.id}
                        aria-describedby={`barber-${barber.id}-desc`}
                        onChange={() => {
                          setSelectedBarber(barber.id);
                          // Auto-scroll to date selection
                          setTimeout(() => {
                            const dateSection = document.querySelector('[data-tour="date-selection"]') as HTMLElement;
                            if (dateSection) {
                              dateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              dateSection.style.border = '3px solid #14b8a6';
                              dateSection.style.borderRadius = '8px';
                              setTimeout(() => {
                                dateSection.style.border = '';
                                dateSection.style.borderRadius = '';
                              }, 2000);
                            }
                          }, 100);
                        }}
                      />
                      <label
                        htmlFor={`barber-${barber.id}`}
                        className="flex items-center p-5 bg-gradient-to-r from-white to-slate-50 border-2 border-slate-200 rounded-xl cursor-pointer peer-checked:border-teal-500 peer-checked:bg-gradient-to-r peer-checked:from-teal-50 peer-checked:to-teal-100 peer-checked:shadow-lg hover:border-teal-300 hover:shadow-md transition-all duration-300"
                      >
                        <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 rounded-full flex items-center justify-center text-white font-bold mr-3 sm:mr-4 shadow-lg text-sm sm:text-base">
                          {barber.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 text-sm sm:text-base truncate">{barber.name}</div>
                          <div className="text-xs sm:text-sm text-slate-500 truncate" id={`barber-${barber.id}-desc`}>{barber.title} • {barber.experience}</div>
                          <div className="flex items-center mt-1">
                            <div className="flex text-yellow-400 mr-2" aria-label={`${barber.rating} out of 5 stars`}>
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className="w-2 h-2 sm:w-3 sm:h-3 fill-current" aria-hidden="true" />
                              ))}
                            </div>
                            <span className="text-xs text-slate-500 sr-only">{barber.rating} out of 5 stars</span>
                            <span className="text-xs text-slate-500" aria-hidden="true">{barber.rating}</span>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                {form.formState.errors.barberId && (
                  <p className="text-sm text-red-500" role="alert" aria-live="polite">{form.formState.errors.barberId.message}</p>
                )}
              </fieldset>

              {/* Date Selection */}
              <fieldset className="space-y-3" data-tour="date-selection" aria-labelledby="date-selection-legend">
                <legend id="date-selection-legend" className="text-sm font-semibold text-slate-700 flex items-center">
                  <Calendar className="text-primary mr-2 w-4 h-4" aria-hidden="true" />
                  Select Date
                </legend>
                <Input
                  type="date"
                  id="date"
                  min={today}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full"
                  aria-describedby={form.formState.errors.date ? "date-error" : undefined}
                  aria-required="true"
                />
                {form.formState.errors.date && (
                  <p id="date-error" className="text-sm text-red-500" role="alert" aria-live="polite">{form.formState.errors.date.message}</p>
                )}
              </fieldset>

              {/* Time Slots */}
              {selectedBarber && selectedDate && (
                <fieldset className="space-y-3" aria-labelledby="time-slots-legend">
                  <legend id="time-slots-legend" className="text-sm font-semibold text-slate-700 flex items-center">
                    <Clock className="text-primary mr-2 w-4 h-4" aria-hidden="true" />
                    Available Time Slots
                  </legend>
                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            setSelectedTime(slot);
                            form.setValue("time", slot);
                            // Auto-scroll to service selection
                            setTimeout(() => {
                              const serviceSection = document.getElementById('service-selection') as HTMLElement;
                              if (serviceSection) {
                                serviceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                serviceSection.style.border = '3px solid #14b8a6';
                                serviceSection.style.borderRadius = '8px';
                                setTimeout(() => {
                                  serviceSection.style.border = '';
                                  serviceSection.style.borderRadius = '';
                                }, 2000);
                              }
                            }, 100);
                          }}
                          className={`p-3 text-center border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                            selectedTime === slot
                              ? "border-teal-500 bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-lg transform scale-105"
                              : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50 hover:shadow-md"
                          }`}
                          aria-pressed={selectedTime === slot}
                          aria-describedby={`time-${slot}-desc`}
                        >
                          <span className="font-semibold text-xs sm:text-sm">{formatTime(slot)}</span>
                          <span id={`time-${slot}-desc`} className="sr-only">
                            {selectedTime === slot ? "Selected time slot" : "Available time slot"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p>No available slots for this date</p>
                    </div>
                  )}
                  {form.formState.errors.time && (
                    <p className="text-sm text-red-500" role="alert" aria-live="polite">{form.formState.errors.time.message}</p>
                  )}
                </fieldset>
              )}

              {/* Customer Information */}
              <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="customer-info" aria-labelledby="customer-info-legend">
                <legend id="customer-info-legend" className="sr-only">Customer Information</legend>
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="text-lg font-semibold text-slate-800 flex items-center">
                    <User className="text-teal-600 mr-3 w-5 h-5" aria-hidden="true" />
                    Your Name
                  </Label>
                  <Input
                    id="customerName"
                    placeholder="Enter your full name"
                    {...form.register("customerName")}
                    aria-required="true"
                    aria-describedby={form.formState.errors.customerName ? "name-error" : undefined}
                  />
                  {form.formState.errors.customerName && (
                    <p id="name-error" className="text-sm text-red-500" role="alert" aria-live="polite">{form.formState.errors.customerName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerPhone" className="text-lg font-semibold text-slate-800 flex items-center">
                    <Phone className="text-teal-600 mr-3 w-5 h-5" aria-hidden="true" />
                    Phone Number
                  </Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    {...form.register("customerPhone")}
                    aria-required="true"
                    aria-describedby={form.formState.errors.customerPhone ? "phone-error" : undefined}
                  />
                  {form.formState.errors.customerPhone && (
                    <p id="phone-error" className="text-sm text-red-500" role="alert" aria-live="polite">{form.formState.errors.customerPhone.message}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="customerEmail" className="text-sm font-semibold text-slate-700 flex items-center">
                    <MessageCircle className="text-primary mr-2 w-4 h-4" aria-hidden="true" />
                    Email Address (Optional)
                  </Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="your.email@example.com"
                    {...form.register("customerEmail")}
                    aria-describedby={form.formState.errors.customerEmail ? "email-error" : "email-help"}
                  />
                  {form.formState.errors.customerEmail && (
                    <p id="email-error" className="text-sm text-red-500" role="alert" aria-live="polite">{form.formState.errors.customerEmail.message}</p>
                  )}
                  <p id="email-help" className="text-xs text-slate-500">Get a personalized confirmation message via email</p>
                </div>
              </fieldset>

              {/* Photo Upload Section */}
              <fieldset className="space-y-3" data-tour="photo-upload" aria-labelledby="photo-upload-legend">
                <legend id="photo-upload-legend" className="text-lg font-semibold text-slate-800 flex items-center">
                  <Camera className="text-teal-600 mr-3 w-5 h-5" aria-hidden="true" />
                  Upload Reference Photo (Optional)
                </legend>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-teal-400 transition-colors duration-200">
                  <input
                    type="file"
                    id="photo-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          // Handle photo upload here
                          console.log('Photo uploaded:', file.name);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    aria-describedby="photo-upload-help"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer block">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" aria-hidden="true" />
                    <p className="text-sm text-slate-600 mb-1">Click to upload a reference photo</p>
                    <p id="photo-upload-help" className="text-xs text-slate-500">Show your barber exactly what you want (PNG, JPG up to 10MB)</p>
                  </label>
                </div>
              </fieldset>

              {/* Service Selection */}
              <fieldset className="space-y-3" data-tour="service-selection" id="service-selection" aria-labelledby="service-selection-legend">
                <legend id="service-selection-legend" className="text-lg font-semibold text-slate-800 flex items-center">
                  <Star className="text-teal-600 mr-3 w-5 h-5" aria-hidden="true" />
                  Select Service
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((service) => (
                    <div key={service.id} className="relative">
                      <input
                        type="radio"
                        id={`service-${service.id}`}
                        name="service"
                        value={service.id}
                        className="sr-only peer"
                        checked={selectedService === service.id}
                        onChange={() => setSelectedService(service.id)}
                        aria-describedby={`service-${service.id}-desc`}
                      />
                      <label
                        htmlFor={`service-${service.id}`}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-white to-slate-50 border-2 border-slate-200 rounded-xl cursor-pointer peer-checked:border-teal-500 peer-checked:bg-gradient-to-r peer-checked:from-teal-50 peer-checked:to-teal-100 peer-checked:shadow-lg hover:border-teal-300 hover:shadow-md transition-all duration-300"
                      >
                        <div>
                          <div className="font-medium text-slate-900">{service.name}</div>
                          <div className="text-sm text-slate-500" id={`service-${service.id}-desc`}>{service.duration} min</div>
                        </div>
                        <div className="text-lg font-bold text-teal-600">{formatPrice(service.price)}</div>
                      </label>
                    </div>
                  ))}
                </div>
                {form.formState.errors.serviceId && (
                  <p className="text-sm text-red-500" role="alert" aria-live="polite">{form.formState.errors.serviceId.message}</p>
                )}
              </fieldset>

              {/* Submit Button */}
              <div className="pt-6">
                <Button
                  type="submit"
                  disabled={createBookingMutation.isPending}
                  className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  aria-describedby="submit-help"
                >
                  {createBookingMutation.isPending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" aria-hidden="true"></div>
                      <span aria-live="polite">Booking Your Appointment...</span>
                    </>
                  ) : (
                    <>
                      <CalendarCheck className="mr-3 w-5 h-5" aria-hidden="true" />
                      Book Your Appointment
                    </>
                  )}
                </Button>
                <p id="submit-help" className="sr-only">
                  Submit your booking request after completing all required fields
                </p>
              </div>

              {/* WhatsApp Button — only shown when VITE_WHATSAPP_NUMBER is set */}
              {whatsappNumber && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="text-center mb-3">
                    <p className="text-sm text-slate-600">Need help or have questions?</p>
                  </div>
                  <Button
                    type="button"
                    onClick={openWhatsApp}
                    className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-green-500 via-green-400 to-green-500 hover:from-green-600 hover:via-green-500 hover:to-green-600 text-white border-0 transition-all duration-300 shadow-lg hover:shadow-xl"
                    variant="outline"
                  >
                    <MessageCircle className="mr-2" />
                    Chat on WhatsApp
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Booking Summary */}
      <div className="space-y-6" data-tour="booking-summary">
        <Card className="shadow-xl border-0 bg-gradient-to-br from-white/95 via-slate-50/90 to-white/95 backdrop-blur-sm transition-all duration-500 hover:shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-slate-50 via-slate-100/50 to-slate-50 border-b border-slate-200/50 rounded-t-lg transition-all duration-300">
            <CardTitle className="text-lg text-slate-900 flex items-center">
              <i className="fas fa-clipboard-list text-indigo-600 mr-2"></i>
              Booking Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Barber:</span>
              <span className="font-medium text-slate-900">
                {selectedBarber ? barbers.find(b => b.id === selectedBarber)?.name : "Not selected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Date:</span>
              <span className="font-medium text-slate-900">
                {selectedDate ? new Date(selectedDate).toLocaleDateString() : "Not selected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Time:</span>
              <span className="font-medium text-slate-900">
                {selectedTime ? formatTime(selectedTime) : "Not selected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Service:</span>
              <span className="font-medium text-slate-900">
                {selectedService ? services.find(s => s.id === selectedService)?.name : "Not selected"}
              </span>
            </div>
            <hr className="border-slate-200" />
            <div className="flex justify-between text-lg font-bold">
              <span className="text-slate-900">Total:</span>
              <span className="text-primary">
                {selectedService ? formatPrice(services.find(s => s.id === selectedService)?.price || 0) : "$0.00"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Store Information */}
        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100/50 rounded-t-lg">
            <CardTitle className="text-lg text-slate-900 flex items-center">
              <i className="fas fa-store text-emerald-600 mr-2"></i>
              Store Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <i className="fas fa-map-marker-alt text-slate-400 mt-1"></i>
              <div>
                <div className="font-medium text-slate-900">{shopName}</div>
                {shopAddress && <div className="text-slate-600">{shopAddress}</div>}
              </div>
            </div>
            {shopPhone && (
              <div className="flex items-center space-x-3">
                <i className="fas fa-phone text-slate-400"></i>
                <span className="text-slate-600">{shopPhone}</span>
              </div>
            )}
            <div className="flex items-center space-x-3">
              <i className="fas fa-clock text-slate-400"></i>
              <div className="text-slate-600">
                <div>{shopHoursWeekday}</div>
                <div>{shopHoursWeekend}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Modal */}
        <SuccessModal
          open={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          bookingDetails={bookingDetails}
        />
      </div>
    </div>
  );
}