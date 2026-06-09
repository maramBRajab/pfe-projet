package com.smartassign.pfe.service;

import java.util.List;

import com.smartassign.pfe.dto.AdminDepartementDto.CollaborateurDepartementRow;
import com.smartassign.pfe.dto.AdminDepartementDto.UpdateDepartementRequest;

public interface AdminDepartementService {

    List<CollaborateurDepartementRow> listCollaborateursDepartements();

    int updateCollaborateursDepartements(List<UpdateDepartementRequest> updates);
}
