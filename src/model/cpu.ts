// eslint-disable-file no-use-before-define
import FIFO from './fifo_page_replace';
import JobQueue from './job_queue';
import { IProcessInput } from './loader';
import MMU from './mmu';
import PhysicalMemory from './physical_memory';
import Process from './process';
import RoundRobin from './rr_scheduler';
import VirtualMemory from './virtual_memory';

export default class CPU {

    scheduler           : RoundRobin;
    mmu                 : MMU;
    computed_process    : Process;
    current_reference   : number;
    ended               : boolean;
    computed_time       : number;

    next_proc_t_arrival : number;
    next_proc           : Process;

    total_processes     : number;
    completed_processes : number;

    virtual : VirtualMemory;
    physical: PhysicalMemory;

    fifo : FIFO;

    input : IProcessInput[] =  [
        {
            pid: 'A',
            arrival_time: 0,
            total_time : 5,
            pages: 2,
        },
        {
            pid: 'B',
            arrival_time: 4,
            total_time : 10,
            pages: 2,
        },
        {
            pid: 'C',
            arrival_time: 1,
            total_time : 3,
            pages: 2,
        },
        {
            pid: 'D',
            arrival_time: 3,
            total_time : 5,
            pages: 2,
        },
    ];

    constructor(){
        //this.scheduler = new RoundRobin(JobQueue.loadFromFile('./model/processes.json'), 4);
        this.scheduler = new RoundRobin(new JobQueue(), 4);
        this.computed_process = this.scheduler.nextProcessToCompute();
        this.ended = false;
        this.computed_time = 0;
        this.mmu = new MMU();
        this.input = this.input.sort((a, b) => {
            return b.arrival_time - a.arrival_time;
        });
        [this.next_proc_t_arrival, this.next_proc] = this.nextProcessToArrival();

        this.virtual = new VirtualMemory(4, 12, 'mb');
        this.physical = new PhysicalMemory(4);

        this.total_processes = 0;
        this.completed_processes = 0;

        this.fifo = new FIFO();
    }

    public next(): boolean {
        console.log(`[TIME]> ${this.computed_time}`);
        if(this.computed_time === this.next_proc_t_arrival){
            this.total_processes++;
            this.scheduler.registerProcess(this.next_proc);
            console.log(`Se registro el proceso: ${this.next_proc} `);
            this.virtual.loadProcess(this.next_proc);
            [this.next_proc_t_arrival, this.next_proc] = this.nextProcessToArrival();
        }
        if(this.computed_process === null)
            this.computed_process = this.scheduler.nextProcessToCompute();
        if(this.hasFinishedTasks()) return false;
        if(!this.scheduler.tick()){
            if(this.computed_process.hasFinished()) this.deleteProcess();
            this.computed_process = this.scheduler.nextProcessToCompute();
            if(this.hasFinishedTasks()) return false;
        }
        this.current_reference = this.computed_process.nextReference()
        this.fifo.referenceProcessPage(this.computed_process.PID, this.current_reference);
        console.log(`${this.computed_process.PID}-${this.current_reference}`);
        this.computed_time++;
        return true;
    }

    private deleteProcess() : void {
        this.completed_processes++;
        let pid = this.computed_process.PID;
        this.virtual.deleteProcess(pid);
        this.scheduler.deleteProcess(pid);
        //this.mmu.deleteProcess(pid);
        console.log(`Se elimino el proceso ${pid}`)
    }

    public referecePage(process : Process){
        this.mmu.referencePage(process);
    }

    public nextProcessToArrival() : [number, Process] | [number, null] {
        if(this.input.length === 0) return [-1, null];
        let next_time : number;
        let next_process : Process;
        let obj = this.input.pop();
        next_process = new Process(obj.pid, obj.total_time, obj.pages);
        next_time = obj.arrival_time;
        return [next_time, next_process];
    }

    public hasFinishedTasks() : boolean {
        let hasComputed = this.computed_process === null;
        let hasInWait = this.next_proc === null && this.next_proc_t_arrival === -1;
        return hasComputed && hasInWait;
    }

}
